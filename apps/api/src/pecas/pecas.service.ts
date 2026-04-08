import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EventsService } from '../events/events.service';
import { CreatePecaDto } from './dto/create-peca.dto';

@Injectable()
export class PecasService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private events: EventsService,
  ) {}

  async create(
    arbitragemId: string,
    userId: string,
    userRole: string,
    dto: CreatePecaDto,
    files?: Express.Multer.File[],
  ) {
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
    });

    if (!arbitragem) throw new NotFoundException('Arbitragem nao encontrada');

    // Verificar acesso
    if (userRole !== 'ADMIN') {
      const isParticipant =
        arbitragem.requerenteId === userId ||
        arbitragem.requeridoId === userId ||
        arbitragem.advRequerenteId === userId ||
        arbitragem.advRequeridoId === userId;
      if (!isParticipant) throw new ForbiddenException('Sem acesso');
    }

    // Upload de anexos
    const anexos: string[] = [];
    if (files?.length) {
      for (const file of files) {
        const key = this.storage.generateKey(arbitragemId, 'pecas', file.originalname);
        const { url } = await this.storage.upload(file.buffer, key, file.mimetype);
        anexos.push(url);
      }
    }

    const peca = await this.prisma.peca.create({
      data: {
        arbitragemId,
        autorId: userId,
        tipo: dto.tipo as any,
        conteudo: dto.conteudo,
        anexos,
      },
      include: {
        autor: { select: { id: true, nome: true, role: true } },
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'PECA_PROTOCOLADA',
        entidade: 'peca',
        entidadeId: peca.id,
        dadosDepois: { tipo: dto.tipo, arbitragemId },
      },
    });

    // Emitir evento para avancar status da arbitragem (AGUARDANDO_PETICAO -> AGUARDANDO_CONTESTACAO -> ANALISE_PROVAS)
    this.events.emitPecaProtocolada({
      arbitragemId,
      numero: arbitragem.numero,
      pecaId: peca.id,
      tipo: String(dto.tipo),
      autorId: userId,
      autorNome: peca.autor?.nome || 'Usuario',
      requerenteId: arbitragem.requerenteId,
      requeridoId: arbitragem.requeridoId,
    });

    return peca;
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

    return this.prisma.peca.findMany({
      where: { arbitragemId },
      orderBy: { protocoladaAt: 'desc' },
      include: {
        autor: { select: { id: true, nome: true, role: true } },
      },
    });
  }
}
