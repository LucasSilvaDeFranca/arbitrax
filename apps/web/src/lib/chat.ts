import { api } from './api';

export interface ChatMessage {
  id: string;
  tipo: string;
  conteudo?: string;
  mediaUrl?: string;
  lida: boolean;
  createdAt: string;
  user: { id: string; nome: string; role: string };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const chatApi = {
  getMessages: (arbitragemId: string, token: string, cursor?: string) => {
    const qs = cursor ? `?cursor=${cursor}` : '';
    return api<ChatMessage[]>(`/api/v1/arbitragens/${arbitragemId}/chat${qs}`, { token });
  },

  send: (arbitragemId: string, data: { conteudo?: string; tipo?: string; mediaUrl?: string }, token: string) =>
    api<ChatMessage>(`/api/v1/arbitragens/${arbitragemId}/chat`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  getUnread: (token: string) =>
    api<number>('/api/v1/chat/unread', { token }),
};
