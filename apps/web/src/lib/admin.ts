import { api } from './api';

export interface AdminStats {
  totalCasos: number;
  casosAtivos: number;
  sentencasPendentes: number;
  totalArbitros: number;
  totalUsuarios: number;
  casosPorStatus: Array<{ status: string; count: number }>;
  casosPorCategoria: Array<{ categoria: string; count: number }>;
}

export interface ArbitroInfo {
  id: string;
  nome: string;
  email: string;
  oabNumero?: string;
  casosAtivos: number;
}

export const adminApi = {
  getStats: (token: string) =>
    api<AdminStats>('/api/v1/admin/stats', { token }),

  listarCasos: (params: Record<string, string>, token: string) => {
    const qs = new URLSearchParams(params).toString();
    return api<any>(`/api/v1/admin/casos?${qs}`, { token });
  },

  listarArbitros: (token: string) =>
    api<ArbitroInfo[]>('/api/v1/admin/arbitros', { token }),

  designarArbitro: (arbitragemId: string, arbitroId: string, token: string) =>
    api(`/api/v1/admin/arbitragens/${arbitragemId}/designar`, {
      method: 'POST',
      body: JSON.stringify({ arbitroId }),
      token,
    }),
};
