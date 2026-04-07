import { api } from './api';

export interface ChatMessage {
  id: string;
  tipo: string;
  canal: string;
  conteudo?: string;
  mediaUrl?: string;
  lida: boolean;
  createdAt: string;
  user: { id: string; nome: string; role: string } | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const chatApi = {
  getMessages: (arbitragemId: string, token: string, canal: string = 'processos', cursor?: string) => {
    const params = new URLSearchParams();
    params.set('canal', canal);
    if (cursor) params.set('cursor', cursor);
    return api<ChatMessage[]>(`/api/v1/arbitragens/${arbitragemId}/chat?${params}`, { token });
  },

  send: (arbitragemId: string, data: { conteudo?: string; tipo?: string; mediaUrl?: string; canal?: string }, token: string) =>
    api<ChatMessage>(`/api/v1/arbitragens/${arbitragemId}/chat`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  askIa: (arbitragemId: string, pergunta: string, canal: string, token: string) =>
    api<ChatMessage>(`/api/v1/arbitragens/${arbitragemId}/chat/ia`, {
      method: 'POST',
      body: JSON.stringify({ pergunta, canal }),
      token,
    }),

  getUnread: (token: string) =>
    api<{ processos: number; arbitragem: number }>('/api/v1/chat/unread', { token }),
};
