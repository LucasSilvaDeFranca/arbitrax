import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrazoDto } from './dto/create-prazo.dto';

/** Dias padrao por tipo de prazo conforme spec */
const PRAZO_DIAS: Record<string, number> = {
  ACEITE: 7,
  ASSINATURA: 7,
  PETICAO: 10,
  CONTESTACAO: 10,
  PROVAS_ADICIONAIS: 5,
  REVISAO_SENTENCA: 5,
  RATIFICACAO: 3,
  CUSTOM: 7,
};

@Injectable()
export class PrazosService {
  private readonly logger = new Logger(PrazosService.name);

  constructor(private prisma: PrismaService) {}

  async create(arbitragemId: string, userId: string, userRole: string, dto: CreatePrazoDto) {
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
    });
    if (!arbitragem) throw new NotFoundException('Arbitragem nao encontrada');

    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Apenas admin pode criar prazos manuais');
    }

    const prazo = await this.prisma.prazo.create({
      data: {
        arbitragemId,
        tipo: dto.tipo as any,
        parteId: dto.parteId,
        inicio: new Date(),
        fim: new Date(dto.fim),
      },
      include: {
        parte: { select: { id: true, nome: true } },
      },
    });

    return prazo;
  }

  /** Criar prazo automatico a partir de transicao de status */
  async createAutomatico(arbitragemId: string, tipo: string, parteId?: string) {
    const dias = PRAZO_DIAS[tipo] || 7;
    const fim = new Date();
    fim.setDate(fim.getDate() + dias);

    return this.prisma.prazo.create({
      data: {
        arbitragemId,
        tipo: tipo as any,
        parteId,
        inicio: new Date(),
        fim,
      },
    });
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

    return this.prisma.prazo.findMany({
      where: { arbitragemId },
      orderBy: { fim: 'asc' },
      include: {
        parte: { select: { id: true, nome: true } },
      },
    });
  }

  /** Cron: verificar prazos expirando e criar notificacoes */
  async processarPrazos() {
    const agora = new Date();
    const em3dias = new Date();
    em3dias.setDate(em3dias.getDate() + 3);
    const em1dia = new Date();
    em1dia.setDate(em1dia.getDate() + 1);

    // Marcar expirados
    const expirados = await this.prisma.prazo.findMany({
      where: { status: 'ATIVO', fim: { lte: agora } },
      include: { parte: true, arbitragem: true },
    });

    for (const prazo of expirados) {
      await this.prisma.prazo.update({
        where: { id: prazo.id },
        data: { status: 'EXPIRADO', notificadoExp: true },
      });

      if (prazo.parteId) {
        await this.criarNotificacao(
          prazo.parteId,
          'Prazo Expirado',
          `O prazo de ${prazo.tipo.toLowerCase().replace(/_/g, ' ')} no caso ${prazo.arbitragem.numero} expirou.`,
          'prazo',
          `/arbitragens/${prazo.arbitragemId}`,
        );
      }

      this.logger.log(`Prazo ${prazo.id} expirado - caso ${prazo.arbitragem.numero}`);
    }

    // Notificar D-1 (faltando 1 dia)
    const d1 = await this.prisma.prazo.findMany({
      where: {
        status: 'ATIVO',
        notificado1d: false,
        fim: { lte: em1dia, gt: agora },
      },
      include: { parte: true, arbitragem: true },
    });

    for (const prazo of d1) {
      await this.prisma.prazo.update({
        where: { id: prazo.id },
        data: { notificado1d: true },
      });

      if (prazo.parteId) {
        await this.criarNotificacao(
          prazo.parteId,
          'Prazo vence AMANHA',
          `Falta 1 dia para o prazo de ${prazo.tipo.toLowerCase().replace(/_/g, ' ')} no caso ${prazo.arbitragem.numero}.`,
          'prazo',
          `/arbitragens/${prazo.arbitragemId}`,
        );
      }
    }

    // Notificar D-3 (faltando 3 dias)
    const d3 = await this.prisma.prazo.findMany({
      where: {
        status: 'ATIVO',
        notificado3d: false,
        fim: { lte: em3dias, gt: em1dia },
      },
      include: { parte: true, arbitragem: true },
    });

    for (const prazo of d3) {
      await this.prisma.prazo.update({
        where: { id: prazo.id },
        data: { notificado3d: true },
      });

      if (prazo.parteId) {
        await this.criarNotificacao(
          prazo.parteId,
          'Prazo em 3 dias',
          `Faltam 3 dias para o prazo de ${prazo.tipo.toLowerCase().replace(/_/g, ' ')} no caso ${prazo.arbitragem.numero}.`,
          'prazo',
          `/arbitragens/${prazo.arbitragemId}`,
        );
      }
    }

    return {
      expirados: expirados.length,
      notificadosD1: d1.length,
      notificadosD3: d3.length,
    };
  }

  private async criarNotificacao(
    userId: string,
    titulo: string,
    mensagem: string,
    tipo: string,
    link?: string,
  ) {
    return this.prisma.notificacao.create({
      data: { userId, titulo, mensagem, tipo, link },
    });
  }
}
