import { api } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface CertificadoStatus {
  temCertificado: boolean;
  cn: string | null;
  emissor: string | null;
  validade: string | null;
  serial: string | null;
  atualizadoEm: string | null;
  expirado: boolean;
  diasRestantes: number | null;
}

export interface CertificadoUploadResult {
  cn: string;
  emissor: string;
  validade: string;
  serial: string;
  message: string;
}

export interface CertificadoValidacao {
  valido: boolean;
  cn: string;
  emissor: string;
  validade: string;
  expirado: boolean;
  message: string;
}

export const certificadoApi = {
  getStatus: (token: string) =>
    api<CertificadoStatus>('/api/v1/certificado-digital/status', { token }),

  upload: async (file: File, senha: string, token: string): Promise<CertificadoUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('senha', senha);

    const res = await fetch(`${API_URL}/api/v1/certificado-digital/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(error.message || `HTTP ${res.status}`);
    }

    return res.json();
  },

  remover: (token: string) =>
    api<{ message: string }>('/api/v1/certificado-digital', { method: 'DELETE', token }),

  validar: (token: string) =>
    api<CertificadoValidacao>('/api/v1/certificado-digital/validar', { method: 'POST', token }),
};
