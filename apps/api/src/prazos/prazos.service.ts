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

  /** Marcar prazo(s) de determinado tipo como CUMPRIDO */
  async marcarCumprido(arbitragemId: string, tipo: string) {
    await this.prisma.prazo.updateMany({
      where: { arbitragemId, tipo: tipo as any, status: 'ATIVO' },
      data: { status: 'CUMPRIDO' },
    });
  }

  /** Cron: verificar prazos expirando e criar notificacoes */
  async processarPrazos() {
    const agora = new Date();
    const em3dias = new Date();
    em3dias.setDate(em3dias.getDate() + 3);
    const em1dia = new Date();
    em1dia.setDate(em1dia.getDate() + 1);

    // --- Expirados: buscar, bulk update, batch notifications ---
    const expirados = await this.prisma.prazo.findMany({
      where: { status: 'ATIVO', fim: { lte: agora } },
      select: {
        id: true,
        tipo: true,
        parteId: true,
        arbitragemId: true,
        arbitragem: { select: { numero: true } },
      },
    });

    if (expirados.length > 0) {
      // Bulk update all expired prazos at once
      await this.prisma.prazo.updateMany({
        where: { id: { in: expirados.map((p) => p.id) } },
        data: { status: 'EXPIRADO', notificadoExp: true },
      });

      // Batch create notifications for expired prazos
      const expNotifs = expirados
        .filter((p) => p.parteId)
        .map((p) => ({
          userId: p.parteId!,
          titulo: 'Prazo Expirado',
          mensagem: `O prazo de ${p.tipo.toLowerCase().replace(/_/g, ' ')} no caso ${p.arbitragem.numero} expirou.`,
          tipo: 'prazo',
          link: `/arbitragens/${p.arbitragemId}`,
        }));

      if (expNotifs.length > 0) {
        await this.prisma.notificacao.createMany({ data: expNotifs });
      }

      for (const prazo of expirados) {
        this.logger.log(`Prazo ${prazo.id} expirado - caso ${prazo.arbitragem.numero}`);
      }
    }

    // --- D-1: buscar, bulk update, batch notifications ---
    const d1 = await this.prisma.prazo.findMany({
      where: {
        status: 'ATIVO',
        notificado1d: false,
        fim: { lte: em1dia, gt: agora },
      },
      select: {
        id: true,
        tipo: true,
        parteId: true,
        arbitragemId: true,
        arbitragem: { select: { numero: true } },
      },
    });

    if (d1.length > 0) {
      await this.prisma.prazo.updateMany({
        where: { id: { in: d1.map((p) => p.id) } },
        data: { notificado1d: true },
      });

      const d1Notifs = d1
        .filter((p) => p.parteId)
        .map((p) => ({
          userId: p.parteId!,
          titulo: 'Prazo vence AMANHA',
          mensagem: `Falta 1 dia para o prazo de ${p.tipo.toLowerCase().replace(/_/g, ' ')} no caso ${p.arbitragem.numero}.`,
          tipo: 'prazo',
          link: `/arbitragens/${p.arbitragemId}`,
        }));

      if (d1Notifs.length > 0) {
        await this.prisma.notificacao.createMany({ data: d1Notifs });
      }
    }

    // --- D-3: buscar, bulk update, batch notifications ---
    const d3 = await this.prisma.prazo.findMany({
      where: {
        status: 'ATIVO',
        notificado3d: false,
        fim: { lte: em3dias, gt: em1dia },
      },
      select: {
        id: true,
        tipo: true,
        parteId: true,
        arbitragemId: true,
        arbitragem: { select: { numero: true } },
      },
    });

    if (d3.length > 0) {
      await this.prisma.prazo.updateMany({
        where: { id: { in: d3.map((p) => p.id) } },
        data: { notificado3d: true },
      });

      const d3Notifs = d3
        .filter((p) => p.parteId)
        .map((p) => ({
          userId: p.parteId!,
          titulo: 'Prazo em 3 dias',
          mensagem: `Faltam 3 dias para o prazo de ${p.tipo.toLowerCase().replace(/_/g, ' ')} no caso ${p.arbitragem.numero}.`,
          tipo: 'prazo',
          link: `/arbitragens/${p.arbitragemId}`,
        }));

      if (d3Notifs.length > 0) {
        await this.prisma.notificacao.createMany({ data: d3Notifs });
      }
    }

    return {
      expirados: expirados.length,
      notificadosD1: d1.length,
      notificadosD3: d3.length,
    };
  }

  /** Contar prazos ativos do usuario (para dashboard) */
  async countAtivosForUser(userId: string, userRole: string): Promise<number> {
    const whereArbitragem: any = {};

    if (userRole === 'ADMIN') {
      // Admin ve todos
    } else if (userRole === 'ARBITRO') {
      whereArbitragem.arbitros = { some: { arbitroId: userId } };
    } else if (userRole === 'ADVOGADO') {
      whereArbitragem.OR = [
        { advRequerenteId: userId },
        { advRequeridoId: userId },
      ];
    } else {
      whereArbitragem.OR = [
        { requerenteId: userId },
        { requeridoId: userId },
      ];
    }

    return this.prisma.prazo.count({
      where: {
        status: 'ATIVO',
        arbitragem: whereArbitragem,
      },
    });
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
