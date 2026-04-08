import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RagService } from '../rag/rag.service';
import { CreateProvaDto } from './dto/create-prova.dto';

@Injectable()
export class ProvasService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private ragService: RagService,
  ) {}

  async upload(
    arbitragemId: string,
    userId: string,
    userRole: string,
    dto: CreateProvaDto,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');

    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
    });

    if (!arbitragem) throw new NotFoundException('Arbitragem nao encontrada');

    if (userRole !== 'ADMIN') {
      const isParticipant =
        arbitragem.requerenteId === userId ||
        arbitragem.requeridoId === userId ||
        arbitragem.advRequerenteId === userId ||
        arbitragem.advRequeridoId === userId;
      if (!isParticipant) throw new ForbiddenException('Sem acesso');
    }

    // Upload para MinIO com hash SHA-256
    const key = this.storage.generateKey(arbitragemId, 'provas', file.originalname);
    const { url, hash } = await this.storage.upload(file.buffer, key, file.mimetype);

    // Detectar tipo automaticamente pelo mimeType
    const tipo = StorageService.detectProvaTipo(file.mimetype);

    const prova = await this.prisma.prova.create({
      data: {
        arbitragemId,
        parteId: userId,
        tipo: tipo as any,
        descricao: dto.descricao,
        arquivoUrl: url,
        hashSha256: hash,
        mimeType: file.mimetype,
        tamanho: file.size,
      },
      include: {
        parte: { select: { id: true, nome: true, role: true } },
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'PROVA_ENVIADA',
        entidade: 'prova',
        entidadeId: prova.id,
        dadosDepois: {
          tipo,
          mimeType: file.mimetype,
          tamanho: file.size,
          hash,
          arbitragemId,
        },
      },
    });

    // Process for RAG (extract text + generate embeddings)
    try {
      const textoExtraido = await this.ragService.processarProva(
        prova.id, file.buffer, file.mimetype,
        { arbitragemId, parteId: userId },
      );
      if (textoExtraido) {
        await this.prisma.prova.update({
          where: { id: prova.id },
          data: { textoExtraido },
        });
      }
    } catch (err: any) {
      // RAG processing failure should not break upload
      console.warn('RAG processing failed:', err.message);
    }

    return prova;
  }

  async findAll(arbitragemId: string, userId: string, userRole: string) {
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
    });

    if (!arbitragem) throw new NotFoundException('Arbitragem nao encontrada');

    if (userRole !== 'ADMIN') {
      const isParticipant =
        arbitragem.requerenteId === userId ||
        arbitragem.requeridoId === userId ||
        arbitragem.advRequerenteId === userId ||
        arbitragem.advRequeridoId === userId;
      if (!isParticipant) throw new ForbiddenException('Sem acesso');
    }

    return this.prisma.prova.findMany({
      where: { arbitragemId },
      orderBy: { createdAt: 'desc' },
      include: {
        parte: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async download(arbitragemId: string, provaId: string, userId: string, userRole: string) {
    const prova = await this.prisma.prova.findFirst({
      where: { id: provaId, arbitragemId },
    });

    if (!prova) throw new NotFoundException('Prova nao encontrada');

    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
    });

    if (userRole !== 'ADMIN') {
      const isParticipant =
        arbitragem!.requerenteId === userId ||
        arbitragem!.requeridoId === userId ||
        arbitragem!.advRequerenteId === userId ||
        arbitragem!.advRequeridoId === userId;
      if (!isParticipant) throw new ForbiddenException('Sem acesso');
    }

    // StorageService aceita URL/key diretamente (extrai key internamente)
    const signedUrl = await this.storage.getSignedDownloadUrl(prova.arquivoUrl);

    return { url: signedUrl, hash: prova.hashSha256, mimeType: prova.mimeType };
  }

  async reprocessarRag(arbitragemId: string, userId: string, userRole: string) {
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: { arbitros: true },
    });
    if (!arbitragem) throw new NotFoundException('Arbitragem nao encontrada');

    // Apenas ADMIN, arbitros do caso, ou participantes podem reprocessar
    if (userRole !== 'ADMIN') {
      const isParticipant =
        arbitragem.requerenteId === userId ||
        arbitragem.requeridoId === userId ||
        arbitragem.advRequerenteId === userId ||
        arbitragem.advRequeridoId === userId ||
        arbitragem.arbitros.some((a) => a.arbitroId === userId);
      if (!isParticipant) throw new ForbiddenException('Sem acesso');
    }

    return this.ragService.reprocessarProvasDaArbitragem(
      arbitragemId,
      (arquivoUrl: string) => this.storage.getBuffer(arquivoUrl),
    );
  }
}
