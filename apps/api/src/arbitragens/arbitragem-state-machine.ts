import { BadRequestException } from '@nestjs/common';

/**
 * State Machine da Arbitragem
 *
 * AGUARDANDO_PAGAMENTO_REGISTRO → AGUARDANDO_ACEITE
 * AGUARDANDO_ACEITE             → AGUARDANDO_ASSINATURA | RECUSADA
 * AGUARDANDO_ASSINATURA         → EM_INSTRUCAO (compromisso assinado)
 * EM_INSTRUCAO                  → AGUARDANDO_CONTESTACAO (abre prazo pro requerido)
 * AGUARDANDO_CONTESTACAO        → ANALISE_PROVAS (contestacao protocolada + Chat 2 criado)
 * ANALISE_PROVAS                → AGUARDANDO_PROVAS_ADICIONAIS | GERANDO_SENTENCA
 * AGUARDANDO_PROVAS_ADICIONAIS  → GERANDO_SENTENCA
 * GERANDO_SENTENCA              → SENTENCA_EM_REVISAO
 * SENTENCA_EM_REVISAO           → GERANDO_SENTENCA | SENTENCA_APROVADA
 * SENTENCA_APROVADA             → SENTENCA_RATIFICADA
 * SENTENCA_RATIFICADA           → ENCERRADA
 * qualquer (exceto ENCERRADA/CANCELADA) → CANCELADA
 *
 * Notas:
 * - A tese do requerente e o proprio objeto do caso (registrado no momento de criar a arbitragem).
 *   Nao existe mais a fase AGUARDANDO_PETICAO separada.
 * - AGUARDANDO_PAGAMENTO_TAXA foi removido por enquanto (sera reintroduzido quando Asaas for ativado).
 */

type Status = string;

const VALID_TRANSITIONS: Record<Status, Status[]> = {
  AGUARDANDO_PAGAMENTO_REGISTRO: ['AGUARDANDO_ACEITE', 'CANCELADA'],
  AGUARDANDO_ACEITE: ['AGUARDANDO_ASSINATURA', 'RECUSADA', 'CANCELADA'],
  AGUARDANDO_ASSINATURA: ['EM_INSTRUCAO', 'CANCELADA'],
  EM_INSTRUCAO: ['AGUARDANDO_CONTESTACAO', 'CANCELADA'],
  AGUARDANDO_CONTESTACAO: ['ANALISE_PROVAS', 'CANCELADA'],
  ANALISE_PROVAS: ['AGUARDANDO_PROVAS_ADICIONAIS', 'GERANDO_SENTENCA', 'CANCELADA'],
  AGUARDANDO_PROVAS_ADICIONAIS: ['GERANDO_SENTENCA', 'CANCELADA'],
  GERANDO_SENTENCA: ['SENTENCA_EM_REVISAO', 'CANCELADA'],
  SENTENCA_EM_REVISAO: ['GERANDO_SENTENCA', 'SENTENCA_APROVADA', 'CANCELADA'],
  SENTENCA_APROVADA: ['SENTENCA_RATIFICADA', 'CANCELADA'],
  SENTENCA_RATIFICADA: ['ENCERRADA', 'CANCELADA'],
  // Legado (pode ser removido em migration futura): mantemos AGUARDANDO_PETICAO e
  // AGUARDANDO_PAGAMENTO_TAXA como estados aceitos caso existam casos antigos no DB.
  AGUARDANDO_PETICAO: ['AGUARDANDO_CONTESTACAO', 'CANCELADA'],
  AGUARDANDO_PAGAMENTO_TAXA: ['EM_INSTRUCAO', 'CANCELADA'],
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
