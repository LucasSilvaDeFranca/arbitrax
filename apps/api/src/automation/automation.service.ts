import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CompromissoService } from '../compromisso/compromisso.service';
import { SentencaService } from '../sentenca/sentenca.service';
import { PrazosService } from '../prazos/prazos.service';
import { EventsService } from '../events/events.service';
import {
  EVENTS,
  ArbitragemCriadaEvent,
  ConviteAceitoEvent,
  CompromissoAssinadoEvent,
  PecaProtocoladaEvent,
  IaAnaliseCompletaEvent,
  SentencaRatificadaEvent,
  PrazoExpiradoEvent,
} from '../events/events.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private prisma: PrismaService,
    private compromissoService: CompromissoService,
    private sentencaService: SentencaService,
    private prazosService: PrazosService,
    private events: EventsService,
  ) {}

  // ─── Handler 1: Auto-designate arbitro on creation ─────────
  @OnEvent(EVENTS.ARBITRAGEM_CRIADA)
  async handleArbitragemCriada(event: ArbitragemCriadaEvent) {
    this.logger.log(`[Automation] arbitragem.criada: ${event.numero}`);

    try {
      // Check if arbitro was already chosen during creation
      const existingArbitro = await this.prisma.arbitragemArbitro.findFirst({
        where: { arbitragemId: event.arbitragemId },
      });
      if (existingArbitro) {
        this.logger.log(`[Automation] Arbitro already assigned for ${event.numero}, skipping auto-designation`);
        return;
      }

      // Round-robin: find ARBITRO user with fewest active cases
      const arbitros = await this.prisma.user.findMany({
        where: { role: 'ARBITRO', ativo: true },
        select: {
          id: true,
          nome: true,
          arbitragemArbitros: {
            where: {
              arbitragem: {
                status: {
                  notIn: ['ENCERRADA', 'CANCELADA', 'RECUSADA'],
                },
              },
            },
            select: { id: true },
          },
        },
      });

      if (arbitros.length === 0) {
        this.logger.warn(`[Automation] No ARBITRO users found, skipping auto-designation for ${event.numero}`);
        return;
      }

      // Pick arbitro with fewest active cases
      const sorted = arbitros.sort(
        (a, b) => a.arbitragemArbitros.length - b.arbitragemArbitros.length,
      );
      const chosen = sorted[0];

      await this.prisma.arbitragemArbitro.create({
        data: {
          arbitragemId: event.arbitragemId,
          arbitroId: chosen.id,
        },
      });

      // Audit log
      await this.prisma.auditLog.create({
        data: {
          acao: 'ARBITRO_AUTO_DESIGNADO',
          entidade: 'arbitragem',
          entidadeId: event.arbitragemId,
          dadosDepois: { arbitroId: chosen.id, arbitroNome: chosen.nome },
        },
      });

      this.logger.log(`[Automation] Arbitro ${chosen.nome} auto-designated for ${event.numero}`);
    } catch (err: any) {
      this.logger.error(`[Automation] Error in handleArbitragemCriada: ${err.message}`, err.stack);
    }
  }

  // ─── Handler 2: Auto-generate compromisso on convite aceito ──
  @OnEvent(EVENTS.CONVITE_ACEITO)
  async handleConviteAceito(event: ConviteAceitoEvent) {
    this.logger.log(`[Automation] convite.aceito: ${event.numero}`);

    try {
      await this.compromissoService.gerar(event.arbitragemId);
      this.logger.log(`[Automation] Compromisso auto-generated for ${event.numero}`);
    } catch (err: any) {
      this.logger.error(`[Automation] Error generating compromisso for ${event.numero}: ${err.message}`, err.stack);
    }
  }

  // ─── Handler 3: Transition to AGUARDANDO_PETICAO after compromisso signed ──
  @OnEvent(EVENTS.COMPROMISSO_ASSINADO)
  async handleCompromissoAssinado(event: CompromissoAssinadoEvent) {
    this.logger.log(`[Automation] compromisso.assinado: ${event.numero}`);

    try {
      // Transition to AGUARDANDO_PETICAO
      await this.prisma.arbitragem.update({
        where: { id: event.arbitragemId },
        data: { status: 'AGUARDANDO_PETICAO' },
      });

      // Create prazo PETICAO (10 dias) for requerente
      await this.prazosService.createAutomatico(
        event.arbitragemId,
        'PETICAO',
        event.requerenteId,
      );

      // Audit log
      await this.prisma.auditLog.create({
        data: {
          acao: 'AUTO_TRANSICAO',
          entidade: 'arbitragem',
          entidadeId: event.arbitragemId,
          dadosDepois: {
            de: 'AGUARDANDO_ASSINATURA',
            para: 'AGUARDANDO_PETICAO',
            motivo: 'Compromisso assinado por ambas as partes',
          },
        },
      });

      this.logger.log(`[Automation] Transitioned to AGUARDANDO_PETICAO for ${event.numero}`);
    } catch (err: any) {
      this.logger.error(`[Automation] Error in handleCompromissoAssinado: ${err.message}`, err.stack);
    }
  }

  // ─── Handler 4: Handle peca protocolada ──
  @OnEvent(EVENTS.PECA_PROTOCOLADA)
  async handlePecaProtocolada(event: PecaProtocoladaEvent) {
    this.logger.log(`[Automation] peca.protocolada: ${event.numero} tipo=${event.tipo}`);

    try {
      const arb = await this.prisma.arbitragem.findUnique({
        where: { id: event.arbitragemId },
      });
      if (!arb) return;

      // PETICAO_INICIAL while AGUARDANDO_PETICAO
      if (event.tipo === 'PETICAO_INICIAL' && arb.status === 'AGUARDANDO_PETICAO') {
        // Mark prazo PETICAO as CUMPRIDO
        await this.prazosService.marcarCumprido(event.arbitragemId, 'PETICAO');

        // Transition to AGUARDANDO_CONTESTACAO
        await this.prisma.arbitragem.update({
          where: { id: event.arbitragemId },
          data: { status: 'AGUARDANDO_CONTESTACAO' },
        });

        // Create prazo CONTESTACAO for requerido
        await this.prazosService.createAutomatico(
          event.arbitragemId,
          'CONTESTACAO',
          arb.requeridoId || undefined,
        );

        await this.prisma.auditLog.create({
          data: {
            acao: 'AUTO_TRANSICAO',
            entidade: 'arbitragem',
            entidadeId: event.arbitragemId,
            dadosDepois: {
              de: 'AGUARDANDO_PETICAO',
              para: 'AGUARDANDO_CONTESTACAO',
              motivo: 'Peticao inicial protocolada',
            },
          },
        });

        this.logger.log(`[Automation] AGUARDANDO_PETICAO -> AGUARDANDO_CONTESTACAO for ${event.numero}`);
      }

      // CONTESTACAO while AGUARDANDO_CONTESTACAO
      if (event.tipo === 'CONTESTACAO' && arb.status === 'AGUARDANDO_CONTESTACAO') {
        // Mark prazo CONTESTACAO as CUMPRIDO
        await this.prazosService.marcarCumprido(event.arbitragemId, 'CONTESTACAO');

        // Transition to ANALISE_PROVAS
        await this.prisma.arbitragem.update({
          where: { id: event.arbitragemId },
          data: { status: 'ANALISE_PROVAS' },
        });

        await this.prisma.auditLog.create({
          data: {
            acao: 'AUTO_TRANSICAO',
            entidade: 'arbitragem',
            entidadeId: event.arbitragemId,
            dadosDepois: {
              de: 'AGUARDANDO_CONTESTACAO',
              para: 'ANALISE_PROVAS',
              motivo: 'Contestacao protocolada',
            },
          },
        });

        this.logger.log(`[Automation] AGUARDANDO_CONTESTACAO -> ANALISE_PROVAS for ${event.numero}`);

        // Launch IA analysis async
        this.launchIaAnalysis(event.arbitragemId, event.numero);
      }
    } catch (err: any) {
      this.logger.error(`[Automation] Error in handlePecaProtocolada: ${err.message}`, err.stack);
    }
  }

  // ─── Handler 5: Handle IA analysis result ──
  @OnEvent(EVENTS.IA_ANALISE_COMPLETA)
  async handleIaAnaliseCompleta(event: IaAnaliseCompletaEvent) {
    this.logger.log(`[Automation] ia.analise.completa: ${event.numero} suficiente=${event.suficiente}`);

    try {
      if (event.suficiente) {
        // Transition to GERANDO_SENTENCA
        await this.prisma.arbitragem.update({
          where: { id: event.arbitragemId },
          data: { status: 'GERANDO_SENTENCA' },
        });

        await this.prisma.auditLog.create({
          data: {
            acao: 'AUTO_TRANSICAO',
            entidade: 'arbitragem',
            entidadeId: event.arbitragemId,
            dadosDepois: {
              de: 'ANALISE_PROVAS',
              para: 'GERANDO_SENTENCA',
              motivo: 'IA determinou provas suficientes',
            },
          },
        });

        // Auto-generate sentenca
        const sentenca = await this.sentencaService.gerar(event.arbitragemId);
        this.logger.log(`[Automation] Sentenca auto-generated v${sentenca.versao} for ${event.numero}`);
      } else {
        // Transition to AGUARDANDO_PROVAS_ADICIONAIS
        await this.prisma.arbitragem.update({
          where: { id: event.arbitragemId },
          data: { status: 'AGUARDANDO_PROVAS_ADICIONAIS' },
        });

        // Get requerente for prazo
        const arb = await this.prisma.arbitragem.findUnique({
          where: { id: event.arbitragemId },
        });

        // Create prazo PROVAS_ADICIONAIS
        await this.prazosService.createAutomatico(
          event.arbitragemId,
          'PROVAS_ADICIONAIS',
          arb?.requerenteId,
        );

        await this.prisma.auditLog.create({
          data: {
            acao: 'AUTO_TRANSICAO',
            entidade: 'arbitragem',
            entidadeId: event.arbitragemId,
            dadosDepois: {
              de: 'ANALISE_PROVAS',
              para: 'AGUARDANDO_PROVAS_ADICIONAIS',
              motivo: 'IA determinou provas insuficientes',
            },
          },
        });

        this.logger.log(`[Automation] Provas insuficientes, awaiting additional for ${event.numero}`);
      }
    } catch (err: any) {
      this.logger.error(`[Automation] Error in handleIaAnaliseCompleta: ${err.message}`, err.stack);
    }
  }

  // ─── Handler 6: Auto-publish after sentenca ratificada ──
  @OnEvent(EVENTS.SENTENCA_RATIFICADA)
  async handleSentencaRatificada(event: SentencaRatificadaEvent) {
    this.logger.log(`[Automation] sentenca.ratificada: ${event.numero}`);

    try {
      // Auto-publish and close (passing null userId for SYSTEM call)
      await this.sentencaService.publicar(event.arbitragemId, null as any);
      this.logger.log(`[Automation] Sentenca auto-published and case closed for ${event.numero}`);
    } catch (err: any) {
      this.logger.error(`[Automation] Error in handleSentencaRatificada: ${err.message}`, err.stack);
    }
  }

  // ─── Handler 7: Handle prazo expirado ──
  @OnEvent(EVENTS.PRAZO_EXPIRADO)
  async handlePrazoExpirado(event: PrazoExpiradoEvent) {
    this.logger.log(`[Automation] prazo.expirado: ${event.numero} tipo=${event.tipo}`);

    try {
      const arb = await this.prisma.arbitragem.findUnique({
        where: { id: event.arbitragemId },
      });
      if (!arb) return;

      // If CONTESTACAO prazo expired while AGUARDANDO_CONTESTACAO: default judgment
      if (event.tipo === 'CONTESTACAO' && arb.status === 'AGUARDANDO_CONTESTACAO') {
        // Auto-advance to ANALISE_PROVAS (revelia / default judgment)
        await this.prisma.arbitragem.update({
          where: { id: event.arbitragemId },
          data: { status: 'ANALISE_PROVAS' },
        });

        await this.prisma.auditLog.create({
          data: {
            acao: 'AUTO_TRANSICAO',
            entidade: 'arbitragem',
            entidadeId: event.arbitragemId,
            dadosDepois: {
              de: 'AGUARDANDO_CONTESTACAO',
              para: 'ANALISE_PROVAS',
              motivo: 'Prazo de contestacao expirado (revelia)',
            },
          },
        });

        this.logger.log(`[Automation] Default judgment: AGUARDANDO_CONTESTACAO -> ANALISE_PROVAS for ${event.numero}`);

        // Launch IA analysis
        this.launchIaAnalysis(event.arbitragemId, event.numero);
      }
    } catch (err: any) {
      this.logger.error(`[Automation] Error in handlePrazoExpirado: ${err.message}`, err.stack);
    }
  }

  // ─── Helper: Launch IA analysis asynchronously ──
  private async launchIaAnalysis(arbitragemId: string, numero: string) {
    try {
      const result = await this.sentencaService.analisarProvas(arbitragemId);
      this.events.emitIaAnaliseCompleta({
        arbitragemId,
        numero,
        suficiente: result.suficiente,
      });
    } catch (err: any) {
      this.logger.error(`[Automation] Error in IA analysis for ${numero}: ${err.message}`, err.stack);
    }
  }
}
