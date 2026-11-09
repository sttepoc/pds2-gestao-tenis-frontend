export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function isExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

// Só ApiError tem texto próprio para o usuário; o resto vira o fallback.
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
