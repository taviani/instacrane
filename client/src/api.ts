import { config } from './config';
import { refreshSession } from './auth';
import { readSession } from './vault';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const settings = config();
  if (!settings.apiUrl) throw new ApiError(0, 'configuration locale absente');
  const session = await readSession();
  const headers = new Headers(init.headers);
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let response: Response;
  try {
    response = await fetch(`${settings.apiUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'réseau indisponible');
  }
  if (response.status === 401 && attempt === 0) {
    const refreshed = await refreshSession();
    if (refreshed.ok) return api<T>(path, init, 1);
    if (refreshed.reason === 'network') throw new ApiError(0, 'réseau indisponible');
    throw new ApiError(401, 'session expirée');
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: { error?: string } | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string };
    } catch {
      if (!response.ok) throw new ApiError(response.status, 'erreur');
      throw new ApiError(response.status, 'réponse illisible');
    }
  }
  if (!response.ok) throw new ApiError(response.status, data?.error || 'erreur');
  return data as T;
}

export function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'erreur';
}
