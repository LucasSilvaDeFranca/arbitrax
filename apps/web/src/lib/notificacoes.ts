import { api } from './api';

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  link?: string;
  createdAt: string;
}

export interface NotificacoesResponse {
  data: Notificacao[];
  total: number;
  naoLidas: number;
}

export const notificacoesApi = {
  list: (token: string, naoLidas = false) =>
    api<NotificacoesResponse>(`/api/v1/notificacoes${naoLidas ? '?naoLidas=true' : ''}`, { token }),

  marcarLida: (id: string, token: string) =>
    api(`/api/v1/notificacoes/${id}/lida`, { method: 'PATCH', token }),

  marcarTodasLidas: (token: string) =>
    api('/api/v1/notificacoes/marcar-todas-lidas', { method: 'POST', token }),
};
