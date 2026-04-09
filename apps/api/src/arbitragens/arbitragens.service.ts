import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArbitragemDto } from './dto/create-arbitragem.dto';
import { ListArbitragensDto } from './dto/list-arbitragens.dto';
import { validateTransition, getAllowedTransitions } from './arbitragem-state-machine';
import { EventsService } from '../events/events.service';
import { PlanosService } from '../planos/planos.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class ArbitragensService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
    private planos: PlanosService,
    private email: EmailService,
  ) {}

  async create(userId: string, userRole: string, dto: CreateArbitragemDto) {
    // TODO: Reativar verificacoes de plano apos fase de testes
    // const limite = await this.planos.verificarLimite(userId);
    // if (!limite.permitido) {
    //   throw new BadRequestException(limite.motivo);
    // }
    // const assinatura = await this.planos.getAssinatura(userId);
    // if (assinatura && assinatura.plano) {
    //   const valorMaxCausa = Number(assinatura.plano.valorMaxCausa);
    //   const valorCausa = Number(dto.valorCausa);
    //   if (valorMaxCausa > 0 && valorCausa > valorMaxCausa) {
    //     throw new BadRequestException(
    //       `Valor da causa excede o maximo permitido pelo plano. Faca upgrade.`,
    //     );
    //   }
    // }

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

    // Determinar requerenteId e advogadoId conforme role
    let requerenteId = userId;
    let advRequerenteId: string | undefined = undefined;

    if (userRole === 'ADVOGADO') {
      // Advogado cria em nome do cliente
      if (dto.requerenteNome && dto.requerenteCpfCnpj && dto.requerenteTelefone) {
        // Buscar ou criar o cliente (requerente)
        let cliente = await this.prisma.user.findFirst({
          where: {
            OR: [
              { cpfCnpj: dto.requerenteCpfCnpj },
              ...(dto.requerenteTelefone ? [{ telefone: dto.requerenteTelefone }] : []),
            ],
          },
        });

        if (!cliente) {
          cliente = await this.prisma.user.create({
            data: {
              nome: dto.requerenteNome,
              cpfCnpj: dto.requerenteCpfCnpj,
              telefone: dto.requerenteTelefone,
              email: dto.requerenteEmail || `${dto.requerenteCpfCnpj.replace(/\D/g, '')}@pendente.arbitrax`,
              senhaHash: '',
              role: 'REQUERENTE',
            },
          });
        }

        requerenteId = cliente.id;
        advRequerenteId = userId; // Advogado fica como advogado do requerente
      }
      // Se advogado nao informar dados do cliente, ele mesmo e o requerente (retrocompativel)
    }

    // Gerar numero sequencial ARB-YYYY-NNNNN
    const numero = await this.generateNumero();

    const arbitragem = await this.prisma.arbitragem.create({
      data: {
        numero,
        requerenteId,
        requeridoId: requerido.id,
        advRequerenteId,
        objeto: dto.objeto,
        valorCausa: dto.valorCausa,
        categoria: dto.categoria as any,
        urgencia: dto.urgencia || false,
        tipoDemandaId: dto.tipoDemandaId,
        regraLeis: dto.regraLeis ?? true,
        regraEquidade: dto.regraEquidade ?? false,
        regraCostumes: dto.regraCostumes ?? false,
        modoArbitro: dto.modoArbitro,
        status: 'AGUARDANDO_PAGAMENTO_REGISTRO',
      },
      include: {
        requerente: { select: { id: true, nome: true, email: true } },
        requerido: { select: { id: true, nome: true, email: true } },
        advRequerente: { select: { id: true, nome: true } },
      },
    });

    // Escolha de arbitro (se solicitada)
    if (dto.arbitroId) {
      // TODO: Reativar verificacao de plano apos fase de testes
      // const plano = assinatura?.plano;
      // if (!plano?.escolherArbitro) {
      //   throw new BadRequestException('Escolha de arbitro disponivel apenas nos planos Plus e Pro');
      // }
      await this.prisma.arbitragemArbitro.create({
        data: {
          arbitragemId: arbitragem.id,
          arbitroId: dto.arbitroId,
        },
      });
    }

    // Audit log da criacao
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'ARBITRAGEM_CRIADA',
        entidade: 'arbitragem',
        entidadeId: arbitragem.id,
        dadosDepois: {
          tipoDemandaId: dto.tipoDemandaId,
          regraLeis: dto.regraLeis ?? true,
          regraEquidade: dto.regraEquidade ?? false,
          regraCostumes: dto.regraCostumes ?? false,
          modoArbitro: dto.modoArbitro || 'sistema',
          arbitroId: dto.arbitroId,
          valorCausa: dto.valorCausa,
          categoria: dto.categoria,
        },
      },
    });

    // Incrementar uso do plano
    await this.planos.incrementarUso(userId);

    // Emitir evento de arbitragem criada
    this.events.emitArbitragemCriada({
      arbitragemId: arbitragem.id,
      numero: arbitragem.numero,
      requerenteId,
      requeridoEmail: requerido.email,
      requeridoNome: requerido.nome,
      objeto: dto.objeto,
      valorCausa: Number(dto.valorCausa),
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
        select: {
          id: true,
          numero: true,
          status: true,
          valorCausa: true,
          categoria: true,
          urgencia: true,
          createdAt: true,
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
    // Payload otimizado: seleciona apenas os campos usados pelo frontend.
    // email/telefone foram removidos - se precisar, fetch separado via /users/:id
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        status: true,
        objeto: true,
        valorCausa: true,
        categoria: true,
        urgencia: true,
        createdAt: true,
        requerenteId: true,
        requeridoId: true,
        advRequerenteId: true,
        advRequeridoId: true,
        requerente: { select: { id: true, nome: true } },
        requerido: { select: { id: true, nome: true } },
        advRequerente: { select: { id: true, nome: true } },
        advRequerido: { select: { id: true, nome: true } },
        arbitros: {
          select: { arbitroId: true, arbitro: { select: { id: true, nome: true } } },
        },
        pecas: { orderBy: { protocoladaAt: 'desc' }, take: 10, select: { id: true, tipo: true, protocoladaAt: true } },
        provas: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, tipo: true, descricao: true, createdAt: true } },
        prazos: { where: { status: 'ATIVO' }, orderBy: { fim: 'asc' }, take: 5, select: { id: true, tipo: true, fim: true, status: true } },
        sentencas: { orderBy: { versao: 'desc' }, take: 1, select: { id: true, versao: true, status: true, codigoVerif: true, assinadoDigitalmenteAt: true } },
        compromisso: { select: { id: true, status: true } },
        _count: { select: { pecas: true, provas: true, prazos: true } },
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

  async indicarAdvogado(arbitragemId: string, userId: string, advogadoEmail: string) {
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: {
        requerente: { select: { id: true, nome: true, email: true } },
        requerido: { select: { id: true, nome: true, email: true } },
        advRequerente: { select: { id: true, nome: true } },
        advRequerido: { select: { id: true, nome: true } },
      },
    });

    if (!arbitragem) {
      throw new NotFoundException('Arbitragem nao encontrada');
    }

    // Determinar se o usuario e requerente ou requerido
    const isRequerente = arbitragem.requerenteId === userId;
    const isRequerido = arbitragem.requeridoId === userId;

    if (!isRequerente && !isRequerido) {
      throw new ForbiddenException('Voce nao e parte desta arbitragem');
    }

    // Buscar advogado pelo email
    const advogado = await this.prisma.user.findFirst({
      where: { email: advogadoEmail, role: 'ADVOGADO' },
    });

    if (!advogado) {
      throw new NotFoundException('Advogado nao encontrado. O advogado precisa estar cadastrado na plataforma.');
    }

    // Atualizar a arbitragem com o advogado
    if (isRequerente) {
      await this.prisma.arbitragem.update({
        where: { id: arbitragemId },
        data: { advRequerenteId: advogado.id },
      });
    } else {
      await this.prisma.arbitragem.update({
        where: { id: arbitragemId },
        data: { advRequeridoId: advogado.id },
      });
    }

    // Notificar o advogado indicado
    await this.prisma.notificacao.create({
      data: {
        userId: advogado.id,
        titulo: 'Indicacao como advogado',
        mensagem: `Voce foi indicado como advogado no caso ${arbitragem.numero}`,
        tipo: 'sistema',
        link: `/arbitragens/${arbitragemId}`,
      },
    }).catch(() => {});

    // Verificar se a outra parte tem advogado; se nao, notificar
    const outraParte = isRequerente ? arbitragem.requerido : arbitragem.requerente;
    const outraParteAdvogado = isRequerente ? arbitragem.advRequerido : arbitragem.advRequerente;

    if (outraParte && !outraParteAdvogado) {
      await this.prisma.notificacao.create({
        data: {
          userId: outraParte.id,
          titulo: 'Parte contraria constituiu advogado',
          mensagem: 'A parte contraria constituiu advogado. Voce pode indicar um advogado para representa-lo.',
          tipo: 'sistema',
          link: `/arbitragens/${arbitragemId}`,
        },
      }).catch(() => {});

      // Enviar email para a outra parte
      if (outraParte.email && !outraParte.email.includes('@pendente.arbitrax')) {
        await this.email.send(
          outraParte.email,
          `Advogado constituido pela parte contraria - ${arbitragem.numero}`,
          `
          <h2>Advogado constituido pela parte contraria</h2>
          <p>Prezado(a) <strong>${outraParte.nome}</strong>,</p>
          <p>Informamos que a parte contraria constituiu advogado no caso <strong>${arbitragem.numero}</strong>.</p>
          <p>Voce tambem pode indicar um advogado para representa-lo, caso deseje.</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/arbitragens/${arbitragemId}" style="background:#1e40af;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
              Ver Caso
            </a>
          </div>
          `,
        );
      }
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'ADVOGADO_INDICADO',
        entidade: 'arbitragem',
        entidadeId: arbitragemId,
        dadosDepois: {
          advogadoId: advogado.id,
          advogadoNome: advogado.nome,
          advogadoEmail: advogado.email,
          indicadoPor: isRequerente ? 'requerente' : 'requerido',
        },
      },
    }).catch(() => {});

    return { message: 'Advogado indicado com sucesso', advogado: { id: advogado.id, nome: advogado.nome } };
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
