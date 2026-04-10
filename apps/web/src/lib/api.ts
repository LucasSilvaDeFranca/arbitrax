const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions extends RequestInit {
  token?: string;
}

/** Tenta renovar o access token usando o refresh token */
async function tryRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
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

  let res = await fetch(`${API_URL}${endpoint}`, { headers, ...rest });

  // Se receber 401 e tem token, tenta renovar e refazer a request
  if (res.status === 401 && token) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${endpoint}`, { headers, ...rest });
    } else {
      // Refresh falhou - limpar e redirecionar para login
      if (typeof window !== 'undefined') {
        localStorage.clear();
        window.location.href = '/login';
      }
      throw new Error('Sessao expirada. Faca login novamente.');
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Download autenticado: faz GET com Bearer token, recebe o blob e abre/baixa.
 * Necessario para endpoints protegidos por JWT (tag <a href> nao pode enviar Authorization header).
 */
export async function downloadAuthenticatedFile(
  endpoint: string,
  token: string,
  filename?: string,
): Promise<void> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let res = await fetch(`${API_URL}${endpoint}`, { headers });

  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (!newToken) {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        window.location.href = '/login';
      }
      throw new Error('Sessao expirada. Faca login novamente.');
    }
    headers['Authorization'] = `Bearer ${newToken}`;
    res = await fetch(`${API_URL}${endpoint}`, { headers });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = `Erro ao baixar arquivo (HTTP ${res.status})`;
    try {
      const json = JSON.parse(text);
      if (json.message) msg = json.message;
    } catch { /* not json */ }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  // Forca download direto (nao abre no browser)
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'documento.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
