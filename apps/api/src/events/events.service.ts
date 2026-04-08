import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ─── Event Type Constants ──────────────────────────────
export const EVENTS = {
  ARBITRAGEM_CRIADA: 'arbitragem.criada',
  CONVITE_ACEITO: 'convite.aceito',
  COMPROMISSO_ASSINADO: 'compromisso.assinado',
  PECA_PROTOCOLADA: 'peca.protocolada',
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
  requeridoId: string | null;
  requeridoNome: string;
}

export interface CompromissoAssinadoEvent {
  arbitragemId: string;
  numero: string;
  requerenteId: string;
  requeridoId: string;
}

export interface PecaProtocoladaEvent {
  arbitragemId: string;
  numero: string;
  pecaId: string;
  tipo: string; // PecaTipo: PETICAO_INICIAL | CONTESTACAO | REPLICA | TREPLICA | ALEGACOES_FINAIS | OUTROS
  autorId: string;
  autorNome: string;
  requerenteId: string;
  requeridoId: string | null;
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

  emitPecaProtocolada(payload: PecaProtocoladaEvent) {
    this.logger.log(`Emitting ${EVENTS.PECA_PROTOCOLADA}: ${payload.numero} tipo=${payload.tipo}`);
    this.eventEmitter.emit(EVENTS.PECA_PROTOCOLADA, payload);
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
