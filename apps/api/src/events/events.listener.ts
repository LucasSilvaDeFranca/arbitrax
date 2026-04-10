import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ChatService } from '../chat/chat.service';
import { ChatIaService } from '../chat/chat-ia.service';
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
    private chatService: ChatService,
    private chatIaService: ChatIaService,
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

      // Abre o Chat 1 (processo) com uma mensagem de boas-vindas.
      // Essa e a primeira mensagem do canal 'processo' - a partir daqui as partes,
      // advogados e arbitros podem se comunicar no grupo publico do caso.
      await this.chatService
        .sendSystemMessage(
          event.arbitragemId,
          `👋 Bem-vindos ao chat do processo ${event.numero}. Este e o canal publico onde todas as partes (requerente, requerido, advogados e arbitros) podem se comunicar. Aguardando assinatura do compromisso arbitral pelas duas partes para dar inicio ao procedimento.`,
          'processo',
        )
        .catch((err) =>
          this.logger.warn(`Chat 1 welcome message falhou: ${err.message}`),
        );

      this.logger.log(`Requerente notified for ${event.numero} and Chat 1 opened`);
    } catch (err: any) {
      this.logger.error(
        `Error handling convite.aceito: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * compromisso.assinado -> EM_INSTRUCAO -> AGUARDANDO_CONTESTACAO
   * Abre prazo de 15 dias para o REQUERIDO apresentar defesa/contestacao.
   * A tese do requerente e o proprio objeto do caso (registrado na criacao),
   * nao existe mais peticao inicial separada.
   */
  @OnEvent(EVENTS.COMPROMISSO_ASSINADO)
  async handleCompromissoAssinado(event: CompromissoAssinadoEvent) {
    this.logger.log(`Handling ${EVENTS.COMPROMISSO_ASSINADO}: ${event.numero}`);

    try {
      // 1. Transicionar arbitragem para AGUARDANDO_CONTESTACAO (pula peticao)
      await this.prisma.arbitragem.update({
        where: { id: event.arbitragemId },
        data: { status: 'AGUARDANDO_CONTESTACAO' },
      });

      // 2. Criar prazo de 15 dias para o REQUERIDO apresentar defesa
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

        // 3. Notificacao in-app para o requerido
        await this.prisma.notificacao.create({
          data: {
            userId: event.requeridoId,
            titulo: 'Compromisso assinado - apresentar defesa',
            mensagem: `O compromisso do caso ${event.numero} foi assinado por ambas as partes. Voce tem 15 dias para apresentar a contestacao.`,
            tipo: 'sistema',
            link: `/arbitragens/${event.arbitragemId}/documentos`,
          },
        });

        // 4. Email para o requerido
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

      // 5. Notificacao de status mudou pro requerente (informativa)
      await this.prisma.notificacao.create({
        data: {
          userId: event.requerenteId,
          titulo: 'Compromisso assinado - aguardando defesa',
          mensagem: `O compromisso do caso ${event.numero} foi assinado. Aguardando o requerido apresentar defesa (15 dias).`,
          tipo: 'sistema',
          link: `/arbitragens/${event.arbitragemId}`,
        },
      });

      // 6. Mensagem de sistema no Chat 1 (processo)
      await this.chatService
        .sendSystemMessage(
          event.arbitragemId,
          `✅ Compromisso arbitral assinado por ambas as partes. O procedimento esta oficialmente iniciado. O requerido tem 15 dias para apresentar a defesa/contestacao.`,
          'processo',
        )
        .catch((err) => this.logger.warn(`Chat 1 system msg falhou: ${err.message}`));

      this.logger.log(
        `[compromisso.assinado] ${event.numero}: EM_INSTRUCAO -> AGUARDANDO_CONTESTACAO, prazo 15d requerido criado`,
      );
    } catch (err: any) {
      this.logger.error(
        `Error handling compromisso.assinado: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * peca.protocolada -> CONTESTACAO em AGUARDANDO_CONTESTACAO -> ANALISE_PROVAS
   * Marca prazo como cumprido, transiciona, notifica arbitros e partes.
   * O Chat 2 (sentenca) sera criado aqui na Etapa 2 (apos implementar canais).
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

      // CONTESTACAO em AGUARDANDO_CONTESTACAO -> ANALISE_PROVAS + cria Chat 2
      if (event.tipo === 'CONTESTACAO' && arb.status === 'AGUARDANDO_CONTESTACAO') {
        // 1. Marca prazo CONTESTACAO como cumprido
        await this.prisma.prazo.updateMany({
          where: {
            arbitragemId: event.arbitragemId,
            tipo: 'CONTESTACAO',
            status: 'ATIVO',
          },
          data: { status: 'CUMPRIDO' },
        });

        // 2. Transiciona status
        await this.prisma.arbitragem.update({
          where: { id: event.arbitragemId },
          data: { status: 'ANALISE_PROVAS' },
        });

        // 3. Busca arbitros designados
        const arbitros = await this.prisma.arbitragemArbitro.findMany({
          where: { arbitragemId: event.arbitragemId },
          select: { arbitroId: true },
        });

        // 4. Publica no Chat 1 (processo) que a contestacao foi protocolada e o caso foi enviado pra analise
        await this.chatService
          .sendSystemMessage(
            event.arbitragemId,
            `📋 Contestacao protocolada por ${event.autorNome}. O caso foi encaminhado para analise do arbitro. Voces serao notificados quando a sentenca for publicada ou se houver perguntas oficiais.`,
            'processo',
          )
          .catch((err) => this.logger.warn(`Chat 1 system msg falhou: ${err.message}`));

        // 5. Cria o Chat 2 (sentenca) postando o resumo inicial da IA e uma mensagem de sistema
        // Isto e feito em background - se falhar, o handler nao quebra, o arbitro pode pedir resumo depois
        try {
          await this.chatService.sendSystemMessage(
            event.arbitragemId,
            `🚪 Chat de sentenca aberto. Este e um canal privado visivel apenas aos arbitros designados e a IA. Aqui voces vao construir a minuta de sentenca. As partes nao tem acesso a este chat. Aguardando analise inicial da IA...`,
            'sentenca',
          );

          const resumoIa = await this.chatIaService.gerarResumoInicialParaSentenca(
            event.arbitragemId,
          );

          await this.chatService.sendIaMessage(
            event.arbitragemId,
            resumoIa,
            'sentenca',
          );

          this.logger.log(
            `[peca.protocolada] ${event.numero}: Chat 2 criado com resumo inicial (${resumoIa.length} chars)`,
          );
        } catch (err: any) {
          this.logger.error(
            `[peca.protocolada] Falha ao criar Chat 2 ou gerar resumo inicial para ${event.numero}: ${err.message}`,
          );
          // Posta mensagem de fallback no Chat 2 pra nao deixar vazio
          await this.chatService
            .sendSystemMessage(
              event.arbitragemId,
              `Chat de sentenca aberto. A geracao automatica do resumo inicial falhou (${err.message}). Arbitro: por favor, analise o caso e envie sua primeira mensagem para a IA.`,
              'sentenca',
            )
            .catch(() => {});
        }

        // 6+7. Notifica arbitros + partes em batch (1 write em vez de N+2)
        const partesIds = [event.requerenteId, event.requeridoId].filter(Boolean) as string[];
        const notificacoes = [
          ...arbitros.map((a) => ({
            userId: a.arbitroId,
            titulo: 'Caso pronto para analise',
            mensagem: `O caso ${event.numero} recebeu a contestacao. O chat de sentenca foi aberto com um resumo inicial da IA.`,
            tipo: 'sistema' as const,
            link: `/arbitragens/${event.arbitragemId}`,
          })),
          ...partesIds.map((parteId) => ({
            userId: parteId,
            titulo: 'Caso em analise',
            mensagem: `O caso ${event.numero} agora esta em analise pelo arbitro. Aguarde a sentenca.`,
            tipo: 'sistema' as const,
            link: `/arbitragens/${event.arbitragemId}`,
          })),
        ];
        if (notificacoes.length) {
          await this.prisma.notificacao.createMany({ data: notificacoes });
        }

        this.logger.log(
          `[peca.protocolada] ${event.numero}: CONTESTACAO -> ANALISE_PROVAS (${arbitros.length} arbitros notificados, Chat 2 criado)`,
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
