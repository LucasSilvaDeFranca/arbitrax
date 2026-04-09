import { api } from './api';

export interface ChatMessage {
  id: string;
  tipo: string; // text | system | ia | document | image | video | audio
  canal: string; // 'processo' | 'sentenca' (legado aceito: privado/arbitragem)
  conteudo?: string;
  mediaUrl?: string;
  lida: boolean;
  createdAt: string;
  user: { id: string; nome: string; role: string } | null;
  // Client-only: estado de envio otimista (nao vem do backend)
  _status?: 'sending' | 'sent' | 'error';
}

export type CanalChat = 'processo' | 'sentenca';

export const chatApi = {
  getMessages: (
    arbitragemId: string,
    token: string,
    canal: CanalChat = 'processo',
    cursor?: string,
  ) => {
    const params = new URLSearchParams();
    params.set('canal', canal);
    if (cursor) params.set('cursor', cursor);
    return api<ChatMessage[]>(
      `/api/v1/arbitragens/${arbitragemId}/chat?${params}`,
      { token },
    );
  },

  send: (
    arbitragemId: string,
    data: { conteudo?: string; tipo?: string; mediaUrl?: string; canal?: CanalChat },
    token: string,
  ) =>
    api<ChatMessage>(`/api/v1/arbitragens/${arbitragemId}/chat`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  /**
   * Arbitro conversa com a IA no chat de sentenca.
   * Canal sempre 'sentenca' - IA so atua nesse canal agora.
   */
  askIa: (arbitragemId: string, pergunta: string, token: string) =>
    api<ChatMessage>(`/api/v1/arbitragens/${arbitragemId}/chat/ia`, {
      method: 'POST',
      body: JSON.stringify({ pergunta, canal: 'sentenca' }),
      token,
    }),

  /**
   * Encaminha uma mensagem do Chat 2 (sentenca) como pergunta oficial no Chat 1 (processo).
   * So arbitros podem encaminhar.
   */
  encaminhar: (
    arbitragemId: string,
    data: { messageId: string; textoEditado?: string },
    token: string,
  ) =>
    api<ChatMessage>(`/api/v1/arbitragens/${arbitragemId}/chat/encaminhar`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  getUnread: (token: string) =>
    api<{ processo: number; sentenca: number }>('/api/v1/chat/unread', { token }),
};
