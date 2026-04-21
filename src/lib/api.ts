const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export function authedHeaders(token: string, extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  // With cookies, we don't strictly need this, but good for share tokens
  if (token) headers['x-share-token'] = token;
  return headers;
}

export function coverUrl(file: { id: string; hasArtwork: boolean } | null | undefined, token = ''): string {
  if (!file) return '/icon.svg';
  if (!file.hasArtwork) return '/icon.svg';
  // Backend will check cookie if token is missing
  return apiUrl(`/api/cover/${file.id}${token ? `?token=${token}` : ''}`);
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token = '', headers, ...rest } = options;
  
  const fetchOptions: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      ...(token ? { 'x-share-token': token } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  };

  let res = await fetch(apiUrl(path), fetchOptions);

  // Auto-refresh logic
  if (res.status === 401 && path !== '/api/auth/refresh' && path !== '/api/auth/login' && path !== '/api/auth/register') {
    try {
      const refreshRes = await fetch(apiUrl('/api/auth/refresh'), { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (refreshRes.ok) {
        res = await fetch(apiUrl(path), fetchOptions);
      }
    } catch (e) {
      console.error('Refresh failed', e);
    }
  }

  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = await res.json();
      msg = body.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}
