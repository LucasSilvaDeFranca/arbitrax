import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  EVENTS,
  ArbitragemCriadaEvent,
  ConviteAceitoEvent,
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
