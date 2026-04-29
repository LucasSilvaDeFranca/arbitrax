import { api } from './api';

export interface Arbitragem {
  id: string;
  numero: string;
  status: string;
  objeto: string;
  valorCausa: number;
  categoria: string;
  urgencia: boolean;
  createdAt: string;
  requerente?: { id: string; nome: string };
  requerido?: { id: string; nome: string };
  allowedTransitions?: string[];
}

export interface ArbitragemListResponse {
  data: Arbitragem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const arbitragensApi = {
  create: (data: any, token: string) =>
    api<Arbitragem>('/api/v1/arbitragens', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  list: (params: Record<string, string>, token: string) => {
    const qs = new URLSearchParams(params).toString();
    return api<ArbitragemListResponse>(`/api/v1/arbitragens?${qs}`, { token });
  },

  getById: (id: string, token: string) =>
    api<Arbitragem>(`/api/v1/arbitragens/${id}`, { token }),

  updateStatus: (id: string, status: string, token: string) =>
    api<Arbitragem>(`/api/v1/arbitragens/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      token,
    }),

  /** Requerido aceita o convite (alternativa ao link publico /convite/[token]) */
  aceitar: (id: string, token: string) =>
    api<Arbitragem>(`/api/v1/arbitragens/${id}/aceitar`, {
      method: 'POST',
      token,
    }),

  /** Requerido recusa o convite */
  recusar: (id: string, token: string) =>
    api<Arbitragem>(`/api/v1/arbitragens/${id}/recusar`, {
      method: 'POST',
      token,
    }),

  getTimeline: (id: string, token: string) =>
    api<any[]>(`/api/v1/arbitragens/${id}/timeline`, { token }),

  indicarAdvogado: (id: string, advogadoEmail: string, token: string) =>
    api<any>(`/api/v1/arbitragens/${id}/indicar-advogado`, {
      method: 'POST',
      body: JSON.stringify({ advogadoEmail }),
      token,
    }),
};
