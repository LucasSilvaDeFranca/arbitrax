import { api } from './api';

export interface SentencaConteudo {
  ementa: string;
  relatorio: string;
  fundamentacao: string;
  dispositivo: string;
  custas: { requerente: number; requerido: number };
}

export interface Sentenca {
  id: string;
  versao: number;
  status: string;
  conteudo: SentencaConteudo;
  hashSha256?: string;
  codigoVerif?: string;
  geradaPor: string;
  createdAt: string;
  aprovacoes?: Array<{
    acao: string;
    sugestoesTexto?: string;
    arbitro: { id: string; nome: string };
    createdAt: string;
  }>;
}

export interface VersaoResumo {
  id: string;
  versao: number;
  status: string;
  geradaPor: string;
  createdAt: string;
  aprovacoes: Array<{ acao: string; arbitro: { nome: string }; createdAt: string }>;
}

export const sentencaApi = {
  getCurrent: (arbitragemId: string, token: string) =>
    api<Sentenca>(`/api/v1/arbitragens/${arbitragemId}/sentenca`, { token }),

  getVersoes: (arbitragemId: string, token: string) =>
    api<VersaoResumo[]>(`/api/v1/arbitragens/${arbitragemId}/sentenca/versoes`, { token }),

  aprovar: (arbitragemId: string, token: string) =>
    api(`/api/v1/arbitragens/${arbitragemId}/sentenca/aprovar`, { method: 'POST', token }),

  sugerir: (arbitragemId: string, sugestoes: string, token: string) =>
    api(`/api/v1/arbitragens/${arbitragemId}/sentenca/sugerir`, {
      method: 'POST',
      body: JSON.stringify({ sugestoes }),
      token,
    }),

  ratificar: (arbitragemId: string, token: string) =>
    api(`/api/v1/arbitragens/${arbitragemId}/sentenca/ratificar`, { method: 'POST', token }),
};
