import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArbitragemDto } from './dto/create-arbitragem.dto';
import { ListArbitragensDto } from './dto/list-arbitragens.dto';
import { validateTransition, getAllowedTransitions } from './arbitragem-state-machine';

@Injectable()
export class ArbitragensService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateArbitragemDto) {
    // Buscar ou criar o requerido
    let requerido = await this.prisma.user.findFirst({
      where: {
        OR: [
          { cpfCnpj: dto.requeridoCpfCnpj },
          { telefone: dto.requeridoTelefone },
        ],
      },
    });

    if (!requerido) {
      requerido = await this.prisma.user.create({
        data: {
          nome: dto.requeridoNome,
          cpfCnpj: dto.requeridoCpfCnpj,
          telefone: dto.requeridoTelefone,
          email: dto.requeridoEmail || `${dto.requeridoCpfCnpj.replace(/\D/g, '')}@pendente.arbitrax`,
          senhaHash: '', // sera definida quando o requerido aceitar
          role: 'REQUERIDO',
        },
      });
    }

    // Gerar numero sequencial ARB-YYYY-NNNNN
    const numero = await this.generateNumero();

    const arbitragem = await this.prisma.arbitragem.create({
      data: {
        numero,
        requerenteId: userId,
        requeridoId: requerido.id,
        objeto: dto.objeto,
        valorCausa: dto.valorCausa,
        categoria: dto.categoria as any,
        urgencia: dto.urgencia || false,
        status: 'AGUARDANDO_PAGAMENTO_REGISTRO',
      },
      include: {
        requerente: { select: { id: true, nome: true, email: true } },
        requerido: { select: { id: true, nome: true, email: true } },
      },
    });

    return arbitragem;
  }

  async findAll(userId: string, userRole: string, dto: ListArbitragensDto) {
    const { page = 1, limit = 10, status, categoria } = dto;
    const skip = (page - 1) * limit;

    // Filtro base: usuario so ve seus proprios casos (exceto ADMIN)
    const where: any = {};

    if (userRole === 'ADMIN') {
      // Admin ve tudo
    } else if (userRole === 'ARBITRO') {
      where.arbitros = { some: { arbitroId: userId } };
    } else if (userRole === 'ADVOGADO') {
      where.OR = [
        { advRequerenteId: userId },
        { advRequeridoId: userId },
      ];
    } else {
      where.OR = [
        { requerenteId: userId },
        { requeridoId: userId },
      ];
    }

    if (status) where.status = status;
    if (categoria) where.categoria = categoria;

    const [data, total] = await Promise.all([
      this.prisma.arbitragem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requerente: { select: { id: true, nome: true } },
          requerido: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.arbitragem.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id },
      include: {
        requerente: { select: { id: true, nome: true, email: true, telefone: true } },
        requerido: { select: { id: true, nome: true, email: true, telefone: true } },
        advRequerente: { select: { id: true, nome: true } },
        advRequerido: { select: { id: true, nome: true } },
        arbitros: {
          include: { arbitro: { select: { id: true, nome: true } } },
        },
        pecas: { orderBy: { protocoladaAt: 'desc' } },
        provas: { orderBy: { createdAt: 'desc' } },
        prazos: { orderBy: { fim: 'asc' } },
        cobrancas: { orderBy: { createdAt: 'desc' } },
        sentencas: { orderBy: { versao: 'desc' }, take: 1 },
        compromisso: true,
      },
    });

    if (!arbitragem) {
      throw new NotFoundException('Arbitragem nao encontrada');
    }

    // Verificar acesso (exceto admin)
    if (userRole !== 'ADMIN') {
      const hasAccess = this.checkAccess(arbitragem, userId, userRole);
      if (!hasAccess) {
        throw new ForbiddenException('Sem acesso a esta arbitragem');
      }
    }

    return {
      ...arbitragem,
      allowedTransitions: getAllowedTransitions(arbitragem.status),
    };
  }

  async updateStatus(id: string, newStatus: string, userId: string, userRole: string) {
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id },
    });

    if (!arbitragem) {
      throw new NotFoundException('Arbitragem nao encontrada');
    }

    // Verificar acesso
    if (userRole !== 'ADMIN') {
      const hasAccess = this.checkAccess(arbitragem, userId, userRole);
      if (!hasAccess) {
        throw new ForbiddenException('Sem acesso a esta arbitragem');
      }
    }

    // Validar transicao de estado
    validateTransition(arbitragem.status, newStatus);

    const updated = await this.prisma.arbitragem.update({
      where: { id },
      data: { status: newStatus as any },
      include: {
        requerente: { select: { id: true, nome: true } },
        requerido: { select: { id: true, nome: true } },
      },
    });

    // Registrar no audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'TRANSICAO_STATUS',
        entidade: 'arbitragem',
        entidadeId: id,
        dadosAntes: { status: arbitragem.status },
        dadosDepois: { status: newStatus },
      },
    });

    return {
      ...updated,
      allowedTransitions: getAllowedTransitions(newStatus),
    };
  }

  async getTimeline(id: string, userId: string, userRole: string) {
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id },
    });

    if (!arbitragem) {
      throw new NotFoundException('Arbitragem nao encontrada');
    }

    if (userRole !== 'ADMIN') {
      const hasAccess = this.checkAccess(arbitragem, userId, userRole);
      if (!hasAccess) {
        throw new ForbiddenException('Sem acesso a esta arbitragem');
      }
    }

    const logs = await this.prisma.auditLog.findMany({
      where: { entidade: 'arbitragem', entidadeId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nome: true, role: true } },
      },
    });

    return logs;
  }

  private checkAccess(arbitragem: any, userId: string, userRole: string): boolean {
    if (userRole === 'ARBITRO') {
      return arbitragem.arbitros?.some((a: any) => a.arbitroId === userId);
    }
    if (userRole === 'ADVOGADO') {
      return arbitragem.advRequerenteId === userId || arbitragem.advRequeridoId === userId;
    }
    return arbitragem.requerenteId === userId || arbitragem.requeridoId === userId;
  }

  private async generateNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ARB-${year}-`;

    const lastArbitragem = await this.prisma.arbitragem.findFirst({
      where: { numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });

    let seq = 1;
    if (lastArbitragem) {
      const lastSeq = parseInt(lastArbitragem.numero.replace(prefix, ''), 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${seq.toString().padStart(5, '0')}`;
  }
}
