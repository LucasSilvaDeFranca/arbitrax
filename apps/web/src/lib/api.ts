const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions extends RequestInit {
  token?: string;
}

export async function api<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    headers,
    ...rest,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const authApi = {
  register: (data: {
    nome: string;
    cpfCnpj: string;
    email: string;
    telefone: string;
    senha: string;
    role: string;
    oabNumero?: string;
  }) => api('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; senha: string }) =>
    api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  refresh: (refreshToken: string) =>
    api('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  me: (token: string) => api('/api/v1/auth/me', { token }),
};
