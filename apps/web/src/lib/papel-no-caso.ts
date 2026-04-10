/**
 * Determina o papel processual de um user dentro de uma arbitragem especifica.
 * Usado no chat (label do autor da msg) e na lista de arbitragens (badge).
 */
export type PapelProcessual =
  | 'Requerente'
  | 'Requerido'
  | 'Adv. Requerente'
  | 'Adv. Requerido'
  | 'Arbitro'
  | null;

export function papelNoCaso(
  userId: string | undefined,
  arb: any,
): PapelProcessual {
  if (!userId || !arb) return null;
  if (
    Array.isArray(arb.arbitros) &&
    arb.arbitros.some((a: any) => a.arbitro?.id === userId || a.arbitroId === userId)
  ) {
    return 'Arbitro';
  }
  if (arb.requerente?.id === userId || arb.requerenteId === userId) return 'Requerente';
  if (arb.requerido?.id === userId || arb.requeridoId === userId) return 'Requerido';
  if (arb.advRequerente?.id === userId || arb.advRequerenteId === userId) return 'Adv. Requerente';
  if (arb.advRequerido?.id === userId || arb.advRequeridoId === userId) return 'Adv. Requerido';
  return null;
}

/** Versao simplificada pra lista de arbitragens (sem arbitro/advogado) */
export function papelSimples(
  arb: { requerente?: { id: string }; requerido?: { id: string } },
  userId?: string,
): 'requerente' | 'requerido' | 'outro' {
  if (!userId) return 'outro';
  if (arb.requerente?.id === userId) return 'requerente';
  if (arb.requerido?.id === userId) return 'requerido';
  return 'outro';
}
