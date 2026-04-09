import { validateTransition, getAllowedTransitions } from './arbitragem-state-machine';
import { BadRequestException } from '@nestjs/common';

describe('ArbitragemStateMachine', () => {
  describe('validateTransition', () => {
    // ── Transicoes validas (fluxo novo: sem AGUARDANDO_PETICAO) ──
    const validTransitions: [string, string][] = [
      ['AGUARDANDO_PAGAMENTO_REGISTRO', 'AGUARDANDO_ACEITE'],
      ['AGUARDANDO_ACEITE', 'AGUARDANDO_ASSINATURA'],
      ['AGUARDANDO_ACEITE', 'RECUSADA'],
      ['AGUARDANDO_ASSINATURA', 'EM_INSTRUCAO'],
      ['EM_INSTRUCAO', 'AGUARDANDO_CONTESTACAO'],
      ['AGUARDANDO_CONTESTACAO', 'ANALISE_PROVAS'],
      ['ANALISE_PROVAS', 'AGUARDANDO_PROVAS_ADICIONAIS'],
      ['ANALISE_PROVAS', 'GERANDO_SENTENCA'],
      ['AGUARDANDO_PROVAS_ADICIONAIS', 'GERANDO_SENTENCA'],
      ['GERANDO_SENTENCA', 'SENTENCA_EM_REVISAO'],
      ['SENTENCA_EM_REVISAO', 'GERANDO_SENTENCA'],
      ['SENTENCA_EM_REVISAO', 'SENTENCA_APROVADA'],
      ['SENTENCA_APROVADA', 'SENTENCA_RATIFICADA'],
      ['SENTENCA_RATIFICADA', 'ENCERRADA'],
      // Legado aceito (casos antigos no DB)
      ['AGUARDANDO_PETICAO', 'AGUARDANDO_CONTESTACAO'],
      ['AGUARDANDO_PAGAMENTO_TAXA', 'EM_INSTRUCAO'],
    ];

    test.each(validTransitions)(
      'deve permitir transicao %s -> %s',
      (from, to) => {
        expect(() => validateTransition(from, to)).not.toThrow();
      },
    );

    // ── CANCELADA de qualquer estado ativo ──
    const cancelableStates = [
      'AGUARDANDO_PAGAMENTO_REGISTRO',
      'AGUARDANDO_ACEITE',
      'AGUARDANDO_ASSINATURA',
      'AGUARDANDO_PAGAMENTO_TAXA',
      'EM_INSTRUCAO',
      'AGUARDANDO_PETICAO',
      'AGUARDANDO_CONTESTACAO',
      'ANALISE_PROVAS',
      'AGUARDANDO_PROVAS_ADICIONAIS',
      'GERANDO_SENTENCA',
      'SENTENCA_EM_REVISAO',
      'SENTENCA_APROVADA',
      'SENTENCA_RATIFICADA',
    ];

    test.each(cancelableStates)(
      'deve permitir cancelar de %s',
      (from) => {
        expect(() => validateTransition(from, 'CANCELADA')).not.toThrow();
      },
    );

    // ── Transicoes invalidas ──
    const invalidTransitions: [string, string][] = [
      ['AGUARDANDO_PAGAMENTO_REGISTRO', 'EM_INSTRUCAO'],
      ['AGUARDANDO_ACEITE', 'EM_INSTRUCAO'],
      ['EM_INSTRUCAO', 'ENCERRADA'],
      ['ANALISE_PROVAS', 'SENTENCA_APROVADA'],
      ['SENTENCA_APROVADA', 'RASCUNHO'],
      ['AGUARDANDO_PETICAO', 'SENTENCA_RATIFICADA'],
    ];

    test.each(invalidTransitions)(
      'deve rejeitar transicao invalida %s -> %s',
      (from, to) => {
        expect(() => validateTransition(from, to)).toThrow(BadRequestException);
      },
    );

    // ── Estados finais nao permitem transicao ──
    const finalStates = ['ENCERRADA', 'CANCELADA', 'RECUSADA'];

    test.each(finalStates)(
      'estado final %s nao permite transicao',
      (state) => {
        expect(() => validateTransition(state, 'AGUARDANDO_ACEITE')).toThrow(
          BadRequestException,
        );
      },
    );
  });

  describe('getAllowedTransitions', () => {
    it('deve retornar transicoes permitidas para AGUARDANDO_ACEITE', () => {
      const allowed = getAllowedTransitions('AGUARDANDO_ACEITE');
      expect(allowed).toContain('AGUARDANDO_ASSINATURA');
      expect(allowed).toContain('RECUSADA');
      expect(allowed).toContain('CANCELADA');
      expect(allowed).not.toContain('EM_INSTRUCAO');
    });

    it('deve retornar array vazio para estados finais', () => {
      expect(getAllowedTransitions('ENCERRADA')).toEqual([]);
      expect(getAllowedTransitions('CANCELADA')).toEqual([]);
      expect(getAllowedTransitions('RECUSADA')).toEqual([]);
    });

    it('ANALISE_PROVAS deve ter 3 opcoes', () => {
      const allowed = getAllowedTransitions('ANALISE_PROVAS');
      expect(allowed).toHaveLength(3);
      expect(allowed).toContain('AGUARDANDO_PROVAS_ADICIONAIS');
      expect(allowed).toContain('GERANDO_SENTENCA');
      expect(allowed).toContain('CANCELADA');
    });
  });
});
