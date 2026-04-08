import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TextExtractorService } from './text-extractor.service';
import { EmbeddingsService } from './embeddings.service';
import { ChunkService } from './chunk.service';

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private schemaReady = false;

  constructor(
    private prisma: PrismaService,
    private textExtractor: TextExtractorService,
    private embeddings: EmbeddingsService,
    private chunkService: ChunkService,
  ) {}

  async onModuleInit() {
    await this.ensurePgvectorSchema();
  }

  /** Idempotent: cria extension pgvector + tabela document_chunks se nao existirem */
  private async ensurePgvectorSchema(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          arbitragem_id uuid NOT NULL,
          prova_id uuid NOT NULL,
          parte_id uuid NOT NULL,
          chunk_index int NOT NULL,
          content text NOT NULL,
          metadata jsonb,
          embedding vector(1536),
          created_at timestamptz DEFAULT now()
        )
      `);
      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS document_chunks_arbitragem_idx ON document_chunks (arbitragem_id)`,
      );
      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS document_chunks_prova_idx ON document_chunks (prova_id)`,
      );
      // HNSW index for fast cosine similarity search (pgvector >= 0.5.0)
      try {
        await this.prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops)`,
        );
      } catch (err: any) {
        this.logger.warn(`HNSW index nao criado (pgvector antigo?): ${err.message}`);
      }
      this.schemaReady = true;
      this.logger.log('pgvector schema pronto (document_chunks)');
    } catch (err: any) {
      this.logger.error(`Falha ao garantir schema pgvector: ${err.message}`);
      this.logger.error('Verifique se a extension "vector" esta habilitada no Supabase (Database > Extensions)');
    }
  }

  async processarProva(
    provaId: string,
    buffer: Buffer,
    mimeType: string,
    metadata: { arbitragemId: string; parteId: string },
  ): Promise<string | null> {
    if (!this.schemaReady) await this.ensurePgvectorSchema();

    // 1. Extract text
    const texto = await this.textExtractor.extractFromFile(buffer, mimeType);
    if (!texto || texto.length < 10) {
      this.logger.log(`Sem texto extraido de prova ${provaId} (${mimeType})`);
      return null;
    }

    this.logger.log(`Texto extraido: ${texto.length} chars de prova ${provaId}`);

    // 2. Get parte info for metadata
    const parte = await this.prisma.user.findUnique({
      where: { id: metadata.parteId },
      select: { nome: true, role: true },
    });

    // 3. Split into chunks
    const chunks = this.chunkService.splitText(texto);
    this.logger.log(`${chunks.length} chunks gerados para prova ${provaId}`);

    // 4. Generate embeddings and store
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embeddings.generateEmbedding(chunks[i]);
      if (embedding.length === 0) {
        this.logger.warn(`Embedding vazio para chunk ${i} da prova ${provaId} (${mimeType}), pulando`);
        continue;
      }

      const embeddingStr = `[${embedding.join(',')}]`;

      try {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO document_chunks (arbitragem_id, prova_id, parte_id, chunk_index, content, metadata, embedding)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7::vector)`,
          metadata.arbitragemId,
          provaId,
          metadata.parteId,
          i,
          chunks[i],
          JSON.stringify({
            parteNome: parte?.nome || 'Desconhecido',
            parteRole: parte?.role || 'DESCONHECIDO',
            mimeType,
            provaId,
          }),
          embeddingStr,
        );
      } catch (err: any) {
        this.logger.error(`Erro ao inserir chunk ${i} da prova ${provaId}: ${err.message}`);
        throw err;
      }
    }

    this.logger.log(`${chunks.length} chunks armazenados no pgvector para prova ${provaId}`);
    return texto;
  }

  async buscarContexto(
    arbitragemId: string,
    query: string,
    topK: number = 10,
  ): Promise<Array<{ content: string; metadata: any; similarity: number }>> {
    if (!this.schemaReady) await this.ensurePgvectorSchema();

    // Generate query embedding
    const queryEmbedding = await this.embeddings.generateEmbedding(query);
    if (queryEmbedding.length === 0) return [];

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Validate embedding format: must be [number,number,...]
    if (!/^\[-?\d+(\.\d+)?(,-?\d+(\.\d+)?)*\]$/.test(embeddingStr)) {
      this.logger.error(`Formato de embedding invalido para busca: ${embeddingStr.slice(0, 100)}`);
      return [];
    }

    try {
      const results = await this.prisma.$queryRawUnsafe<Array<{
        content: string;
        metadata: any;
        similarity: number;
      }>>(
        `SELECT content, metadata, 1 - (embedding <=> $1::vector) as similarity
         FROM document_chunks
         WHERE arbitragem_id = $2::uuid
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        embeddingStr,
        arbitragemId,
        topK,
      );

      return results;
    } catch (err: any) {
      this.logger.error(`Erro na busca de contexto RAG para arbitragem ${arbitragemId}: ${err.message}`);
      return [];
    }
  }

  async deletarChunksProva(provaId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      'DELETE FROM document_chunks WHERE prova_id = $1::uuid',
      provaId,
    );
  }

  /**
   * Reprocessa todas as provas de uma arbitragem (baixa arquivo, extrai texto, gera embeddings).
   * Util quando a tabela document_chunks foi criada depois das provas ja terem sido uploadadas.
   */
  async reprocessarProvasDaArbitragem(
    arbitragemId: string,
    downloadBuffer: (arquivoUrl: string) => Promise<Buffer>,
  ): Promise<{ total: number; processadas: number; puladas: number; erros: number }> {
    if (!this.schemaReady) await this.ensurePgvectorSchema();

    const provas = await this.prisma.prova.findMany({
      where: { arbitragemId },
      select: { id: true, arquivoUrl: true, mimeType: true, parteId: true },
    });

    let processadas = 0;
    let puladas = 0;
    let erros = 0;

    for (const prova of provas) {
      try {
        // Remove chunks antigos dessa prova (se houver)
        await this.deletarChunksProva(prova.id);

        // Baixa arquivo e reprocessa
        const buffer = await downloadBuffer(prova.arquivoUrl);
        const texto = await this.processarProva(prova.id, buffer, prova.mimeType || '', {
          arbitragemId,
          parteId: prova.parteId,
        });

        if (texto) {
          await this.prisma.prova.update({
            where: { id: prova.id },
            data: { textoExtraido: texto },
          });
          processadas++;
        } else {
          puladas++;
        }
      } catch (err: any) {
        this.logger.error(`Erro ao reprocessar prova ${prova.id}: ${err.message}`);
        erros++;
      }
    }

    return { total: provas.length, processadas, puladas, erros };
  }
}
