const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export function authedHeaders(token: string, extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  if (token) headers['x-share-token'] = token;
  return headers;
}

export function coverUrl(file: { id: string; hasArtwork: boolean } | null | undefined, token = ''): string {
  if (!file) return '/icon.svg';
  if (!file.hasArtwork) return '/icon.svg';
  return apiUrl(`/api/cover/${file.id}${token ? `?token=${token}` : ''}`);
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token = '', headers, ...rest } = options;
  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      ...(token ? { 'x-share-token': token } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });
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
