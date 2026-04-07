import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TextExtractorService } from './text-extractor.service';
import { EmbeddingsService } from './embeddings.service';
import { ChunkService } from './chunk.service';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private prisma: PrismaService,
    private textExtractor: TextExtractorService,
    private embeddings: EmbeddingsService,
    private chunkService: ChunkService,
  ) {}

  async processarProva(
    provaId: string,
    buffer: Buffer,
    mimeType: string,
    metadata: { arbitragemId: string; parteId: string },
  ): Promise<string | null> {
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
      if (embedding.length === 0) continue;

      const embeddingStr = `[${embedding.join(',')}]`;

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
    }

    this.logger.log(`${chunks.length} chunks armazenados no pgvector para prova ${provaId}`);
    return texto;
  }

  async buscarContexto(
    arbitragemId: string,
    query: string,
    topK: number = 10,
  ): Promise<Array<{ content: string; metadata: any; similarity: number }>> {
    // Generate query embedding
    const queryEmbedding = await this.embeddings.generateEmbedding(query);
    if (queryEmbedding.length === 0) return [];

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

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
  }

  async deletarChunksProva(provaId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      'DELETE FROM document_chunks WHERE prova_id = $1::uuid',
      provaId,
    );
  }
}
