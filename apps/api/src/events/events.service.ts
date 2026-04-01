import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ─── Event Type Constants ──────────────────────────────
export const EVENTS = {
  ARBITRAGEM_CRIADA: 'arbitragem.criada',
  CONVITE_ACEITO: 'convite.aceito',
  COMPROMISSO_ASSINADO: 'compromisso.assinado',
  SENTENCA_RATIFICADA: 'sentenca.ratificada',
  PRAZO_EXPIRADO: 'prazo.expirado',
} as const;

// ─── Event Payload Interfaces ──────────────────────────
export interface ArbitragemCriadaEvent {
  arbitragemId: string;
  numero: string;
  requerenteId: string;
  requeridoEmail?: string;
  requeridoNome?: string;
  objeto: string;
  valorCausa: number;
}

export interface ConviteAceitoEvent {
  arbitragemId: string;
  numero: string;
  requerenteId: string;
  requeridoId: string;
  requeridoNome: string;
}

export interface CompromissoAssinadoEvent {
  arbitragemId: string;
  numero: string;
  requerenteId: string;
  requeridoId: string;
}

export interface SentencaRatificadaEvent {
  arbitragemId: string;
  numero: string;
  sentencaId: string;
  requerenteId: string;
  requeridoId: string;
  codigoVerif?: string;
}

export interface PrazoExpiradoEvent {
  prazoId: string;
  arbitragemId: string;
  numero: string;
  tipo: string;
  parteId: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  emitArbitragemCriada(payload: ArbitragemCriadaEvent) {
    this.logger.log(`Emitting ${EVENTS.ARBITRAGEM_CRIADA}: ${payload.numero}`);
    this.eventEmitter.emit(EVENTS.ARBITRAGEM_CRIADA, payload);
  }

  emitConviteAceito(payload: ConviteAceitoEvent) {
    this.logger.log(`Emitting ${EVENTS.CONVITE_ACEITO}: ${payload.numero}`);
    this.eventEmitter.emit(EVENTS.CONVITE_ACEITO, payload);
  }

  emitCompromissoAssinado(payload: CompromissoAssinadoEvent) {
    this.logger.log(`Emitting ${EVENTS.COMPROMISSO_ASSINADO}: ${payload.numero}`);
    this.eventEmitter.emit(EVENTS.COMPROMISSO_ASSINADO, payload);
  }

  emitSentencaRatificada(payload: SentencaRatificadaEvent) {
    this.logger.log(`Emitting ${EVENTS.SENTENCA_RATIFICADA}: ${payload.numero}`);
    this.eventEmitter.emit(EVENTS.SENTENCA_RATIFICADA, payload);
  }

  emitPrazoExpirado(payload: PrazoExpiradoEvent) {
    this.logger.log(`Emitting ${EVENTS.PRAZO_EXPIRADO}: ${payload.numero}`);
    this.eventEmitter.emit(EVENTS.PRAZO_EXPIRADO, payload);
  }
}
