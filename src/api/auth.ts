// Cliente das rotas de autenticação da API (US02): /api/v1/auth/login, /me e /logout.

export type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export type Session = {
  token: string;
  expiresAt: string;
  user: User;
};

type LoginResponse = {
  access_token: string;
  token_type: 'bearer';
  expires_at: string;
  user: User;
};

type ErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const BASE_URL = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api/v1/auth`;
const SERVER_UNAVAILABLE = 'Não foi possível falar com o servidor do clube. Tente de novo em instantes.';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(SERVER_UNAVAILABLE, 0);
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (response.ok && body) return body;

  if (response.status === 429) {
    const seconds = Number(response.headers.get('Retry-After'));
    const wait = seconds > 0 ? `em ${seconds} segundos` : 'em instantes';
    throw new ApiError(`Muitas tentativas seguidas. Tente de novo ${wait}.`, 429);
  }
  if (response.status >= 500 || !body) {
    throw new ApiError(SERVER_UNAVAILABLE, response.status);
  }
  throw new ApiError(body.message ?? SERVER_UNAVAILABLE, response.status, body.errors ?? {});
}

export async function login(email: string, password: string): Promise<Session> {
  const data = await request<LoginResponse>('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { token: data.access_token, expiresAt: data.expires_at, user: data.user };
}

export async function fetchCurrentUser(token: string): Promise<User> {
  const { data } = await request<{ data: User }>('/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function logout(token: string): Promise<void> {
  await request<void>('/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
