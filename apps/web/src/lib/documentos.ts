const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Peca {
  id: string;
  tipo: string;
  conteudo?: string;
  anexos: string[];
  protocoladaAt: string;
  autor: { id: string; nome: string; role: string };
}

export interface Prova {
  id: string;
  tipo: string;
  descricao?: string;
  arquivoUrl: string;
  hashSha256: string;
  mimeType?: string;
  tamanho?: number;
  createdAt: string;
  parte: { id: string; nome: string; role: string };
}

export const pecasApi = {
  list: (arbitragemId: string, token: string) =>
    fetch(`${API_URL}/api/v1/arbitragens/${arbitragemId}/pecas`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (!r.ok) throw new Error('Erro ao listar pecas');
      return r.json() as Promise<Peca[]>;
    }),

  create: (arbitragemId: string, formData: FormData, token: string) =>
    fetch(`${API_URL}/api/v1/arbitragens/${arbitragemId}/pecas`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then((r) => {
      if (!r.ok) throw new Error('Erro ao protocolar peca');
      return r.json() as Promise<Peca>;
    }),
};

export const provasApi = {
  list: (arbitragemId: string, token: string) =>
    fetch(`${API_URL}/api/v1/arbitragens/${arbitragemId}/provas`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (!r.ok) throw new Error('Erro ao listar provas');
      return r.json() as Promise<Prova[]>;
    }),

  upload: (arbitragemId: string, formData: FormData, token: string) =>
    fetch(`${API_URL}/api/v1/arbitragens/${arbitragemId}/provas`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then((r) => {
      if (!r.ok) throw new Error('Erro ao enviar prova');
      return r.json() as Promise<Prova>;
    }),

  download: (arbitragemId: string, provaId: string, token: string) =>
    fetch(`${API_URL}/api/v1/arbitragens/${arbitragemId}/provas/${provaId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (!r.ok) throw new Error('Erro ao baixar prova');
      return r.json() as Promise<{ url: string; hash: string; mimeType: string }>;
    }),
};

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function tipoIcon(tipo: string): string {
  switch (tipo) {
    case 'IMAGEM': return '🖼';
    case 'VIDEO': return '🎬';
    case 'AUDIO': return '🎵';
    default: return '📄';
  }
}
