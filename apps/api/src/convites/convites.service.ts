import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { EventsService } from '../events/events.service';
import { CompromissoService } from '../compromisso/compromisso.service';

@Injectable()
export class ConvitesService {
  private readonly logger = new Logger(ConvitesService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private events: EventsService,
    @Inject(forwardRef(() => CompromissoService))
    private compromissoService: CompromissoService,
  ) {}

  /** Criar convite automaticamente ao criar arbitragem */
  async criarConvite(arbitragemId: string) {
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: {
        requerente: true,
        requerido: true,
      },
    });

    if (!arb || !arb.requerido) return null;

    // Verificar se ja existe
    const existing = await this.prisma.convite.findUnique({
      where: { arbitragemId },
    });
    if (existing) return existing;

    const expiracao = new Date();
    expiracao.setDate(expiracao.getDate() + 5);

    const convite = await this.prisma.convite.create({
      data: {
        arbitragemId,
        expiracaoAt: expiracao,
      },
    });

    // Enviar email ao requerido
    if (arb.requerido.email && !arb.requerido.email.includes('@pendente.arbitrax')) {
      await this.email.enviarConvite(
        arb.requerido.email,
        arb.requerido.nome,
        {
          numero: arb.numero,
          objeto: arb.objeto,
          requerenteNome: arb.requerente.nome,
          valorCausa: Number(arb.valorCausa),
          conviteToken: convite.token,
        },
      );
    }

    return convite;
  }

  /** Consultar convite por token (publico) */
  async consultarPorToken(token: string) {
    const convite = await this.prisma.convite.findUnique({
      where: { token },
      include: {
        arbitragem: {
          select: {
            id: true,
            numero: true,
            objeto: true,
            valorCausa: true,
            categoria: true,
            status: true,
            createdAt: true,
            regraLeis: true,
            regraEquidade: true,
            regraCostumes: true,
            requerente: { select: { nome: true } },
            requerido: { select: { id: true, nome: true, email: true } },
          },
        },
      },
    });

    if (!convite) throw new NotFoundException('Convite nao encontrado');

    // Verificar expiracao
    if (convite.status === 'pendente' && new Date() > convite.expiracaoAt) {
      await this.prisma.convite.update({
        where: { id: convite.id },
        data: { status: 'expirado' },
      });
      convite.status = 'expirado';
    }

    // Verificar se requerido ja tem conta (senha definida)
    let requeridoTemConta = false;
    if (convite.arbitragem?.requerido?.id) {
      const requerido = await this.prisma.user.findUnique({
        where: { id: convite.arbitragem.requerido.id },
        select: { senhaHash: true },
      });
      requeridoTemConta = !!(requerido?.senhaHash && requerido.senhaHash !== '');
    }

    return { ...convite, requeridoTemConta };
  }

  /** Aceitar convite (pode ser sem login) */
  async aceitar(
    token: string,
    body?: { aceiteRegras?: boolean; aceiteLei?: boolean; aceiteEquidade?: boolean; aceiteCostumes?: boolean; senha?: string },
  ) {
    const convite = await this.consultarPorToken(token);

    if (convite.status !== 'pendente') {
      throw new BadRequestException(`Convite ja foi ${convite.status}`);
    }

    // Validar aceite obrigatorio das regras de arbitragem
    if (!body?.aceiteRegras) {
      throw new BadRequestException('E obrigatorio aceitar as regras de arbitragem para prosseguir.');
    }

    // Se requerido nao tem senha e body tem senha, ativar conta
    let authTokens: any = null;
    const requeridoId = convite.arbitragem?.requerido?.id;
    if (requeridoId && body?.senha) {
      const requerido = await this.prisma.user.findUnique({ where: { id: requeridoId } });
      if (requerido && (!requerido.senhaHash || requerido.senhaHash === '')) {
        const bcrypt = await import('bcryptjs');
        const senhaHash = await bcrypt.hash(body.senha, 10);
        await this.prisma.user.update({
          where: { id: requeridoId },
          data: { senhaHash, ativo: true },
        });

        // Gerar JWT tokens para login automatico
        const { JwtService } = await import('@nestjs/jwt');
        // Usar import dinamico nao funciona para JwtService, retornar flag para frontend fazer login
        authTokens = { contaCriada: true, email: requerido.email };
      }
    }

    await this.prisma.convite.update({
      where: { id: convite.id },
      data: {
        status: 'aceito',
        respondidoAt: new Date(),
        aceiteRegras: body.aceiteRegras ?? false,
        aceiteLei: body.aceiteLei ?? false,
        aceiteEquidade: body.aceiteEquidade ?? false,
        aceiteCostumes: body.aceiteCostumes ?? false,
      },
    });

    // Avancar arbitragem para AGUARDANDO_ASSINATURA
    await this.prisma.arbitragem.update({
      where: { id: convite.arbitragemId },
      data: { status: 'AGUARDANDO_ASSINATURA' },
    });

    // Auto-gerar compromisso arbitral (PDF)
    try {
      await this.compromissoService.gerar(convite.arbitragemId);
      this.logger.log(`Compromisso gerado automaticamente para ${convite.arbitragemId}`);
    } catch (err: any) {
      this.logger.warn(`Compromisso nao gerado automaticamente: ${err.message}`);
    }

    // Audit log do aceite das regras
    await this.prisma.auditLog.create({
      data: {
        userId: convite.arbitragem?.requerido?.id || null,
        acao: 'CONVITE_ACEITO_COM_REGRAS',
        entidade: 'convite',
        entidadeId: convite.id,
        dadosDepois: {
          aceiteRegras: body?.aceiteRegras ?? false,
          aceiteLei: body?.aceiteLei ?? false,
          aceiteEquidade: body?.aceiteEquidade ?? false,
          aceiteCostumes: body?.aceiteCostumes ?? false,
          arbitragemId: convite.arbitragemId,
        },
      },
    }).catch(() => {});

    // Buscar arbitragem completa para notificacao e email
    const arbFull = await this.prisma.arbitragem.findUnique({
      where: { id: convite.arbitragemId },
      include: { requerente: true, requerido: true },
    });

    if (arbFull) {
      // Notificar requerente com o ID correto
      await this.prisma.notificacao.create({
        data: {
          userId: arbFull.requerenteId,
          titulo: 'Convite aceito',
          mensagem: `${arbFull.requerido?.nome} aceitou participar da arbitragem ${arbFull.numero}.`,
          tipo: 'sistema',
          link: `/arbitragens/${arbFull.id}`,
        },
      }).catch(() => {}); // silenciar se falhar

      // Email ao requerente
      await this.email.enviarCasoAceitoRecusado(
        arbFull.requerente.email,
        arbFull.requerente.nome,
        { numero: arbFull.numero, aceito: true, requeridoNome: arbFull.requerido?.nome || '' },
      );

      // Emitir evento de convite aceito
      this.events.emitConviteAceito({
        arbitragemId: arbFull.id,
        numero: arbFull.numero,
        requerenteId: arbFull.requerenteId,
        requeridoId: arbFull.requeridoId,
        requeridoNome: arbFull.requerido?.nome || '',
      });
    }

    return {
      message: 'Convite aceito com sucesso',
      arbitragemId: convite.arbitragemId,
      ...(authTokens || {}),
    };
  }

  /** Recusar convite */
  async recusar(token: string) {
    const convite = await this.consultarPorToken(token);

    if (convite.status !== 'pendente') {
      throw new BadRequestException(`Convite ja foi ${convite.status}`);
    }

    await this.prisma.convite.update({
      where: { id: convite.id },
      data: { status: 'recusado', respondidoAt: new Date() },
    });

    await this.prisma.arbitragem.update({
      where: { id: convite.arbitragemId },
      data: { status: 'RECUSADA' },
    });

    // Notificar e emailar requerente
    const arbFull = await this.prisma.arbitragem.findUnique({
      where: { id: convite.arbitragemId },
      include: { requerente: true, requerido: true },
    });
    if (arbFull) {
      await this.email.enviarCasoAceitoRecusado(
        arbFull.requerente.email,
        arbFull.requerente.nome,
        { numero: arbFull.numero, aceito: false, requeridoNome: arbFull.requerido?.nome || '' },
      );
    }

    return { message: 'Convite recusado' };
  }
}
