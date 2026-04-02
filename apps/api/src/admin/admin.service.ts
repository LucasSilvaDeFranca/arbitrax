import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /** Dashboard stats */
  async getStats() {
    const [
      totalCasos,
      casosAtivos,
      sentencasPendentes,
      totalArbitros,
      totalUsuarios,
    ] = await Promise.all([
      this.prisma.arbitragem.count(),
      this.prisma.arbitragem.count({
        where: { status: { notIn: ['ENCERRADA', 'CANCELADA', 'RECUSADA'] } },
      }),
      this.prisma.sentenca.count({
        where: { status: { in: ['RASCUNHO', 'EM_REVISAO'] } },
      }),
      this.prisma.user.count({ where: { role: 'ARBITRO' } }),
      this.prisma.user.count(),
    ]);

    // Casos por status
    const casosPorStatus = await this.prisma.arbitragem.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // Casos por categoria
    const casosPorCategoria = await this.prisma.arbitragem.groupBy({
      by: ['categoria'],
      _count: { id: true },
    });

    return {
      totalCasos,
      casosAtivos,
      sentencasPendentes,
      totalArbitros,
      totalUsuarios,
      casosPorStatus: casosPorStatus.map((c) => ({ status: c.status, count: c._count.id })),
      casosPorCategoria: casosPorCategoria.map((c) => ({ categoria: c.categoria, count: c._count.id })),
    };
  }

  /** Listar todos os casos (admin) */
  async listarCasos(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.arbitragem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requerente: { select: { id: true, nome: true } },
          requerido: { select: { id: true, nome: true } },
          arbitros: {
            include: { arbitro: { select: { id: true, nome: true } } },
          },
        },
      }),
      this.prisma.arbitragem.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Listar arbitros com carga de trabalho */
  async listarArbitros() {
    const arbitros = await this.prisma.user.findMany({
      where: { role: 'ARBITRO', ativo: true },
      select: {
        id: true,
        nome: true,
        email: true,
        oabNumero: true,
        createdAt: true,
        arbitragemArbitros: {
          where: {
            arbitragem: { status: { notIn: ['ENCERRADA', 'CANCELADA', 'RECUSADA'] } },
          },
          select: { id: true },
        },
      },
    });

    return arbitros.map((a) => ({
      id: a.id,
      nome: a.nome,
      email: a.email,
      oabNumero: a.oabNumero,
      casosAtivos: a.arbitragemArbitros.length,
      criadoEm: a.createdAt,
    }));
  }

  /** Designar arbitro para caso */
  async designarArbitro(arbitragemId: string, arbitroId: string, adminId: string) {
    const arb = await this.prisma.arbitragem.findUnique({ where: { id: arbitragemId } });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    const arbitro = await this.prisma.user.findFirst({
      where: { id: arbitroId, role: 'ARBITRO', ativo: true },
    });
    if (!arbitro) throw new NotFoundException('Arbitro nao encontrado ou inativo');

    // Verificar duplicata
    const existing = await this.prisma.arbitragemArbitro.findFirst({
      where: { arbitragemId, arbitroId },
    });
    if (existing) throw new BadRequestException('Arbitro ja designado para este caso');

    const designacao = await this.prisma.arbitragemArbitro.create({
      data: { arbitragemId, arbitroId },
      include: { arbitro: { select: { id: true, nome: true } } },
    });

    // Notificar arbitro
    await this.prisma.notificacao.create({
      data: {
        userId: arbitroId,
        titulo: 'Novo caso designado',
        mensagem: `Voce foi designado para o caso ${arb.numero}.`,
        tipo: 'sistema',
        link: `/arbitragens/${arbitragemId}`,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        acao: 'ARBITRO_DESIGNADO',
        entidade: 'arbitragem',
        entidadeId: arbitragemId,
        dadosDepois: { arbitroId, arbitroNome: arbitro.nome },
      },
    });

    return designacao;
  }

  /** Listar casos de um arbitro */
  async casosDoArbitro(arbitroId: string) {
    return this.prisma.arbitragemArbitro.findMany({
      where: { arbitroId },
      include: {
        arbitragem: {
          select: {
            id: true,
            numero: true,
            status: true,
            valorCausa: true,
            categoria: true,
            createdAt: true,
            requerente: { select: { nome: true } },
            requerido: { select: { nome: true } },
          },
        },
      },
      orderBy: { designadoAt: 'desc' },
    });
  }

  /** Arbitro declara impedimento/suspeicao */
  async declararImpedimento(arbitragemId: string, arbitroId: string, motivo: string) {
    const designacao = await this.prisma.arbitragemArbitro.findFirst({
      where: { arbitragemId, arbitroId },
    });
    if (!designacao) throw new NotFoundException('Arbitro nao designado para este caso');

    await this.prisma.arbitragemArbitro.update({
      where: { id: designacao.id },
      data: { status: 'impedido' },
    });

    // Notificar admin
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' } });
    const arb = await this.prisma.arbitragem.findUnique({ where: { id: arbitragemId } });
    const arbitro = await this.prisma.user.findUnique({ where: { id: arbitroId } });

    for (const admin of admins) {
      await this.prisma.notificacao.create({
        data: {
          userId: admin.id,
          titulo: 'Impedimento declarado',
          mensagem: `Arbitro ${arbitro?.nome} declarou impedimento no caso ${arb?.numero}. Motivo: ${motivo}`,
          tipo: 'sistema',
          link: `/arbitragens/${arbitragemId}`,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: arbitroId,
        acao: 'IMPEDIMENTO_DECLARADO',
        entidade: 'arbitragem',
        entidadeId: arbitragemId,
        dadosDepois: { motivo, arbitroId },
      },
    });

    return { message: 'Impedimento declarado com sucesso' };
  }

  /** Listar audit logs */
  async getAuditLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Criar arbitro (admin) */
  async criarArbitro(data: { nome: string; cpfCnpj: string; email: string; telefone: string; oabNumero?: string }) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { cpfCnpj: data.cpfCnpj }] },
    });
    if (existing) throw new BadRequestException('Arbitro ja cadastrado');

    const bcrypt = await import('bcryptjs');
    const senhaHash = await bcrypt.hash('arbitro123', 10);

    return this.prisma.user.create({
      data: {
        ...data,
        senhaHash,
        role: 'ARBITRO',
      },
      select: { id: true, nome: true, email: true, oabNumero: true, role: true },
    });
  }
}
