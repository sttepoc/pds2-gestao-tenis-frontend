import { ApiError } from './error';

const BASE_URL = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api/v1`;
const SERVER_UNAVAILABLE = 'Não foi possível falar com o servidor do clube. Tente de novo em instantes.';

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(SERVER_UNAVAILABLE, 0);
  }
  if (response.status === 204 && response.ok) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && body !== null) return body as T;
  if (response.status === 429) {
    const seconds = Number(response.headers.get('Retry-After'));
    const wait = seconds > 0 ? `em ${seconds} segundos` : 'em instantes';
    throw new ApiError(`Muitas tentativas seguidas. Tente de novo ${wait}.`, 429);
  }
  if (response.status >= 500 || !body || typeof body !== 'object') {
    throw new ApiError(SERVER_UNAVAILABLE, response.status);
  }
  const error = body as { message?: string; errors?: Record<string, string[]> };
  throw new ApiError(error.message ?? SERVER_UNAVAILABLE, response.status, error.errors ?? {});
}
