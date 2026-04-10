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
  pdfUrl?: string;
  geradaPor: string;
  createdAt: string;
  assinadoDigitalmenteAt?: string;
  assinadoDigitalmentePor?: string;
  certificadoCn?: string;
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
  gerar: (arbitragemId: string, token: string) =>
    api<Sentenca>(`/api/v1/arbitragens/${arbitragemId}/sentenca/gerar`, { method: 'POST', token }),

  getCurrent: (arbitragemId: string, token: string) =>
    api<Sentenca>(`/api/v1/arbitragens/${arbitragemId}/sentenca`, { token }),

  getVersoes: (arbitragemId: string, token: string) =>
    api<VersaoResumo[]>(`/api/v1/arbitragens/${arbitragemId}/sentenca/versoes`, { token }),

  editar: (arbitragemId: string, conteudo: { ementa?: string; relatorio?: string; fundamentacao?: string; dispositivo?: string }, token: string) =>
    api(`/api/v1/arbitragens/${arbitragemId}/sentenca/editar`, {
      method: 'POST', body: JSON.stringify(conteudo), token,
    }),

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

  assinarDigital: (arbitragemId: string, token: string) =>
    api<{ message: string; pdfUrl: string; hash: string; certificadoCn: string }>(
      `/api/v1/arbitragens/${arbitragemId}/sentenca/assinar-digital`,
      { method: 'POST', token },
    ),
};
