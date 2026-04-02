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

export interface AuditLogEntry {
  id: string;
  userId: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  dadosAntes?: any;
  dadosDepois?: any;
  createdAt: string;
  user?: { nome: string };
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

  criarArbitro: (data: { nome: string; cpfCnpj: string; email: string; telefone: string; oabNumero?: string }, token: string) =>
    api('/api/v1/admin/arbitros', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  getAuditLogs: (params: { page?: string; limit?: string }, token: string) => {
    const qs = new URLSearchParams(params).toString();
    return api<{ data: AuditLogEntry[]; meta: any }>(`/api/v1/admin/audit-logs?${qs}`, { token });
  },
};
