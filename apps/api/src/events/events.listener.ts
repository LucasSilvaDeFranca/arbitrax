import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  EVENTS,
  ArbitragemCriadaEvent,
  ConviteAceitoEvent,
  CompromissoAssinadoEvent,
  PecaProtocoladaEvent,
  SentencaRatificadaEvent,
  PrazoExpiradoEvent,
} from './events.service';

@Injectable()
export class EventsListener {
  private readonly logger = new Logger(EventsListener.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * arbitragem.criada -> Create convite + send email to requerido
   */
  @OnEvent(EVENTS.ARBITRAGEM_CRIADA)
  async handleArbitragemCriada(event: ArbitragemCriadaEvent) {
    this.logger.log(`Handling ${EVENTS.ARBITRAGEM_CRIADA}: ${event.numero}`);

    try {
      // Create convite with 5 business days expiration
      const expiracaoAt = new Date();
      expiracaoAt.setDate(expiracaoAt.getDate() + 7); // ~5 business days

      const convite = await this.prisma.convite.create({
        data: {
          arbitragemId: event.arbitragemId,
          expiracaoAt,
        },
      });

      // Send email to requerido if email is available
      if (event.requeridoEmail && event.requeridoNome) {
        const requerente = await this.prisma.user.findUnique({
          where: { id: event.requerenteId },
          select: { nome: true },
        });

        await this.emailService.enviarConvite(
          event.requeridoEmail,
          event.requeridoNome,
          {
            numero: event.numero,
            objeto: event.objeto,
            requerenteNome: requerente?.nome || 'Requerente',
            valorCausa: event.valorCausa,
            conviteToken: convite.token,
          },
        );
      }

      this.logger.log(`Convite created and email sent for ${event.numero}`);
    } catch (err: any) {
      this.logger.error(
        `Error handling arbitragem.criada: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * convite.aceito -> Notify requerente that requerido accepted
   */
  @OnEvent(EVENTS.CONVITE_ACEITO)
  async handleConviteAceito(event: ConviteAceitoEvent) {
    this.logger.log(`Handling ${EVENTS.CONVITE_ACEITO}: ${event.numero}`);

    try {
      const requerente = await this.prisma.user.findUnique({
        where: { id: event.requerenteId },
        select: { email: true, nome: true },
      });

      if (requerente) {
        await this.emailService.enviarCasoAceitoRecusado(
          requerente.email,
          requerente.nome,
          {
            numero: event.numero,
            aceito: true,
            requeridoNome: event.requeridoNome,
          },
        );
      }

      // Create notification
      await this.prisma.notificacao.create({
        data: {
          userId: event.requerenteId,
          titulo: 'Convite Aceito',
          mensagem: `O requerido ${event.requeridoNome} aceitou a arbitragem ${event.numero}.`,
          tipo: 'sistema',
          link: `/arbitragens/${event.arbitragemId}`,
        },
      });

      this.logger.log(`Requerente notified for ${event.numero}`);
    } catch (err: any) {
      this.logger.error(
        `Error handling convite.aceito: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * compromisso.assinado -> EM_INSTRUCAO -> AGUARDANDO_PETICAO
   * Cria prazo de 15 dias para requerente protocolar peticao inicial + notifica.
   */
  @OnEvent(EVENTS.COMPROMISSO_ASSINADO)
  async handleCompromissoAssinado(event: CompromissoAssinadoEvent) {
    this.logger.log(`Handling ${EVENTS.COMPROMISSO_ASSINADO}: ${event.numero}`);

    try {
      // 1. Transicionar arbitragem para AGUARDANDO_PETICAO
      await this.prisma.arbitragem.update({
        where: { id: event.arbitragemId },
        data: { status: 'AGUARDANDO_PETICAO' },
      });

      // 2. Criar prazo de 15 dias para o requerente protocolar peticao inicial
      const fim = new Date();
      fim.setDate(fim.getDate() + 15);
      await this.prisma.prazo.create({
        data: {
          arbitragemId: event.arbitragemId,
          tipo: 'PETICAO',
          parteId: event.requerenteId,
          fim,
          status: 'ATIVO',
        },
      });

      // 3. Notificacao in-app para o requerente
      await this.prisma.notificacao.create({
        data: {
          userId: event.requerenteId,
          titulo: 'Compromisso assinado - protocolar peticao inicial',
          mensagem: `O compromisso do caso ${event.numero} foi assinado por ambas as partes. Voce tem 15 dias para protocolar a peticao inicial.`,
          tipo: 'sistema',
          link: `/arbitragens/${event.arbitragemId}/documentos`,
        },
      });

      // 4. Email para o requerente
      const requerente = await this.prisma.user.findUnique({
        where: { id: event.requerenteId },
        select: { email: true, nome: true },
      });
      if (requerente) {
        await this.emailService.enviarNotificacaoPrazo(
          requerente.email,
          requerente.nome,
          {
            tipo: 'PETICAO_INICIAL',
            diasRestantes: 15,
            casoNumero: event.numero,
          },
        ).catch((err) => this.logger.warn(`Email peticao falhou: ${err.message}`));
      }

      this.logger.log(
        `[compromisso.assinado] ${event.numero}: status -> AGUARDANDO_PETICAO, prazo 15d criado`,
      );
    } catch (err: any) {
      this.logger.error(
        `Error handling compromisso.assinado: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * peca.protocolada -> avanca status conforme tipo da peca
   * PETICAO_INICIAL  -> AGUARDANDO_PETICAO    -> AGUARDANDO_CONTESTACAO (+ prazo 15d requerido)
   * CONTESTACAO      -> AGUARDANDO_CONTESTACAO -> ANALISE_PROVAS (+ notifica arbitros)
   */
  @OnEvent(EVENTS.PECA_PROTOCOLADA)
  async handlePecaProtocolada(event: PecaProtocoladaEvent) {
    this.logger.log(
      `Handling ${EVENTS.PECA_PROTOCOLADA}: ${event.numero} tipo=${event.tipo}`,
    );

    try {
      const arb = await this.prisma.arbitragem.findUnique({
        where: { id: event.arbitragemId },
        select: { status: true },
      });
      if (!arb) return;

      // Caso 1: PETICAO_INICIAL quando status = AGUARDANDO_PETICAO
      if (event.tipo === 'PETICAO_INICIAL' && arb.status === 'AGUARDANDO_PETICAO') {
        // Marca prazo PETICAO como cumprido
        await this.prisma.prazo.updateMany({
          where: {
            arbitragemId: event.arbitragemId,
            tipo: 'PETICAO',
            status: 'ATIVO',
          },
          data: { status: 'CUMPRIDO' },
        });

        // Transiciona status
        await this.prisma.arbitragem.update({
          where: { id: event.arbitragemId },
          data: { status: 'AGUARDANDO_CONTESTACAO' },
        });

        // Cria prazo de 15 dias para requerido contestar (se tiver requerido)
        if (event.requeridoId) {
          const fim = new Date();
          fim.setDate(fim.getDate() + 15);
          await this.prisma.prazo.create({
            data: {
              arbitragemId: event.arbitragemId,
              tipo: 'CONTESTACAO',
              parteId: event.requeridoId,
              fim,
              status: 'ATIVO',
            },
          });

          // Notifica requerido
          await this.prisma.notificacao.create({
            data: {
              userId: event.requeridoId,
              titulo: 'Peticao inicial protocolada - apresentar contestacao',
              mensagem: `A peticao inicial do caso ${event.numero} foi protocolada por ${event.autorNome}. Voce tem 15 dias para apresentar contestacao.`,
              tipo: 'sistema',
              link: `/arbitragens/${event.arbitragemId}/documentos`,
            },
          });

          // Email
          const requerido = await this.prisma.user.findUnique({
            where: { id: event.requeridoId },
            select: { email: true, nome: true },
          });
          if (requerido) {
            await this.emailService.enviarNotificacaoPrazo(
              requerido.email,
              requerido.nome,
              {
                tipo: 'CONTESTACAO',
                diasRestantes: 15,
                casoNumero: event.numero,
              },
            ).catch((err) => this.logger.warn(`Email contestacao falhou: ${err.message}`));
          }
        }

        this.logger.log(
          `[peca.protocolada] ${event.numero}: PETICAO_INICIAL -> AGUARDANDO_CONTESTACAO`,
        );
        return;
      }

      // Caso 2: CONTESTACAO quando status = AGUARDANDO_CONTESTACAO
      if (event.tipo === 'CONTESTACAO' && arb.status === 'AGUARDANDO_CONTESTACAO') {
        // Marca prazo CONTESTACAO como cumprido
        await this.prisma.prazo.updateMany({
          where: {
            arbitragemId: event.arbitragemId,
            tipo: 'CONTESTACAO',
            status: 'ATIVO',
          },
          data: { status: 'CUMPRIDO' },
        });

        // Transiciona status
        await this.prisma.arbitragem.update({
          where: { id: event.arbitragemId },
          data: { status: 'ANALISE_PROVAS' },
        });

        // Notifica arbitros designados
        const arbitros = await this.prisma.arbitragemArbitro.findMany({
          where: { arbitragemId: event.arbitragemId },
          select: { arbitroId: true, arbitro: { select: { email: true, nome: true } } },
        });

        for (const a of arbitros) {
          await this.prisma.notificacao.create({
            data: {
              userId: a.arbitroId,
              titulo: 'Caso pronto para analise',
              mensagem: `O caso ${event.numero} recebeu a contestacao. Analise as pecas e provas e gere a sentenca quando apropriado.`,
              tipo: 'sistema',
              link: `/arbitragens/${event.arbitragemId}`,
            },
          });
        }

        // Tambem notifica as partes que o caso esta em analise
        const partesIds = [event.requerenteId, event.requeridoId].filter(Boolean) as string[];
        for (const parteId of partesIds) {
          await this.prisma.notificacao.create({
            data: {
              userId: parteId,
              titulo: 'Caso em analise',
              mensagem: `O caso ${event.numero} agora esta em analise pelo arbitro. Aguarde a sentenca.`,
              tipo: 'sistema',
              link: `/arbitragens/${event.arbitragemId}`,
            },
          });
        }

        this.logger.log(
          `[peca.protocolada] ${event.numero}: CONTESTACAO -> ANALISE_PROVAS (${arbitros.length} arbitros notificados)`,
        );
        return;
      }

      this.logger.log(
        `[peca.protocolada] ${event.numero}: nenhuma transicao aplicavel (tipo=${event.tipo}, status=${arb.status})`,
      );
    } catch (err: any) {
      this.logger.error(
        `Error handling peca.protocolada: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * sentenca.ratificada -> Email both parties
   */
  @OnEvent(EVENTS.SENTENCA_RATIFICADA)
  async handleSentencaRatificada(event: SentencaRatificadaEvent) {
    this.logger.log(
      `Handling ${EVENTS.SENTENCA_RATIFICADA}: ${event.numero}`,
    );

    try {
      const [requerente, requerido] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: event.requerenteId },
          select: { email: true, nome: true },
        }),
        this.prisma.user.findUnique({
          where: { id: event.requeridoId },
          select: { email: true, nome: true },
        }),
      ]);

      const casoData = {
        numero: event.numero,
        acao: 'Ratificada',
        codigoVerif: event.codigoVerif,
      };

      if (requerente) {
        await this.emailService.enviarNotificacaoSentenca(
          requerente.email,
          requerente.nome,
          casoData,
        );
      }

      if (requerido) {
        await this.emailService.enviarNotificacaoSentenca(
          requerido.email,
          requerido.nome,
          casoData,
        );
      }

      // Create notifications for both parties
      const notifications = [event.requerenteId, event.requeridoId].map(
        (userId) => ({
          userId,
          titulo: 'Sentenca Ratificada',
          mensagem: `A sentenca do caso ${event.numero} foi ratificada.`,
          tipo: 'sentenca' as const,
          link: `/arbitragens/${event.arbitragemId}`,
        }),
      );

      await this.prisma.notificacao.createMany({ data: notifications });

      this.logger.log(`Both parties notified for sentenca ${event.numero}`);
    } catch (err: any) {
      this.logger.error(
        `Error handling sentenca.ratificada: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * prazo.expirado -> Email the affected party
   */
  @OnEvent(EVENTS.PRAZO_EXPIRADO)
  async handlePrazoExpirado(event: PrazoExpiradoEvent) {
    this.logger.log(`Handling ${EVENTS.PRAZO_EXPIRADO}: ${event.numero}`);

    try {
      const parte = await this.prisma.user.findUnique({
        where: { id: event.parteId },
        select: { email: true, nome: true },
      });

      if (parte) {
        await this.emailService.enviarNotificacaoPrazo(
          parte.email,
          parte.nome,
          {
            tipo: event.tipo,
            diasRestantes: 0,
            casoNumero: event.numero,
          },
        );
      }

      // Create notification
      await this.prisma.notificacao.create({
        data: {
          userId: event.parteId,
          titulo: 'Prazo Expirado',
          mensagem: `O prazo de ${event.tipo.toLowerCase().replace(/_/g, ' ')} no caso ${event.numero} expirou.`,
          tipo: 'prazo',
          link: `/arbitragens/${event.arbitragemId}`,
        },
      });

      this.logger.log(`Party notified of expired deadline for ${event.numero}`);
    } catch (err: any) {
      this.logger.error(
        `Error handling prazo.expirado: ${err.message}`,
        err.stack,
      );
    }
  }
}
