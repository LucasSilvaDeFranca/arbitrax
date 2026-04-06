import { BadRequestException } from '@nestjs/common';

/**
 * State Machine da Arbitragem — 17 transicoes validas
 *
 * AGUARDANDO_PAGAMENTO_REGISTRO → AGUARDANDO_ACEITE
 * AGUARDANDO_ACEITE             → AGUARDANDO_ASSINATURA | RECUSADA
 * AGUARDANDO_ASSINATURA         → AGUARDANDO_PAGAMENTO_TAXA
 * AGUARDANDO_PAGAMENTO_TAXA     → EM_INSTRUCAO
 * EM_INSTRUCAO                  → AGUARDANDO_PETICAO
 * AGUARDANDO_PETICAO            → AGUARDANDO_CONTESTACAO
 * AGUARDANDO_CONTESTACAO        → ANALISE_PROVAS
 * ANALISE_PROVAS                → AGUARDANDO_PROVAS_ADICIONAIS | GERANDO_SENTENCA
 * AGUARDANDO_PROVAS_ADICIONAIS  → GERANDO_SENTENCA
 * GERANDO_SENTENCA              → SENTENCA_EM_REVISAO
 * SENTENCA_EM_REVISAO           → GERANDO_SENTENCA | SENTENCA_APROVADA
 * SENTENCA_APROVADA             → SENTENCA_RATIFICADA
 * SENTENCA_RATIFICADA           → ENCERRADA
 * qualquer (exceto ENCERRADA/CANCELADA) → CANCELADA
 */

type Status = string;

const VALID_TRANSITIONS: Record<Status, Status[]> = {
  AGUARDANDO_PAGAMENTO_REGISTRO: ['AGUARDANDO_ACEITE', 'CANCELADA'],
  AGUARDANDO_ACEITE: ['AGUARDANDO_ASSINATURA', 'RECUSADA', 'CANCELADA'],
  AGUARDANDO_ASSINATURA: ['AGUARDANDO_PAGAMENTO_TAXA', 'EM_INSTRUCAO', 'AGUARDANDO_PETICAO', 'CANCELADA'],
  AGUARDANDO_PAGAMENTO_TAXA: ['EM_INSTRUCAO', 'CANCELADA'],
  EM_INSTRUCAO: ['AGUARDANDO_PETICAO', 'CANCELADA'],
  AGUARDANDO_PETICAO: ['AGUARDANDO_CONTESTACAO', 'CANCELADA'],
  AGUARDANDO_CONTESTACAO: ['ANALISE_PROVAS', 'CANCELADA'],
  ANALISE_PROVAS: ['AGUARDANDO_PROVAS_ADICIONAIS', 'GERANDO_SENTENCA', 'CANCELADA'],
  AGUARDANDO_PROVAS_ADICIONAIS: ['GERANDO_SENTENCA', 'CANCELADA'],
  GERANDO_SENTENCA: ['SENTENCA_EM_REVISAO', 'CANCELADA'],
  SENTENCA_EM_REVISAO: ['GERANDO_SENTENCA', 'SENTENCA_APROVADA', 'CANCELADA'],
  SENTENCA_APROVADA: ['SENTENCA_RATIFICADA', 'CANCELADA'],
  SENTENCA_RATIFICADA: ['ENCERRADA', 'CANCELADA'],
  RECUSADA: [],
  ENCERRADA: [],
  CANCELADA: [],
};

export function validateTransition(currentStatus: Status, newStatus: Status): void {
  const allowed = VALID_TRANSITIONS[currentStatus];

  if (!allowed) {
    throw new BadRequestException(`Status atual '${currentStatus}' e desconhecido`);
  }

  if (allowed.length === 0) {
    throw new BadRequestException(
      `Arbitragem com status '${currentStatus}' nao permite mais transicoes`,
    );
  }

  if (!allowed.includes(newStatus)) {
    throw new BadRequestException(
      `Transicao invalida: '${currentStatus}' -> '${newStatus}'. ` +
        `Transicoes permitidas: ${allowed.join(', ')}`,
    );
  }
}

export function getAllowedTransitions(currentStatus: Status): Status[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}
