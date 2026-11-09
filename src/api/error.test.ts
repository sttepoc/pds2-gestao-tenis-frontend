import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage, isExpired } from './error';

describe('error helpers', () => {
  it('isExpired só para ApiError 401', () => {
    expect(isExpired(new ApiError('x', 401))).toBe(true);
    expect(isExpired(new ApiError('x', 403))).toBe(false);
    expect(isExpired(new Error('x'))).toBe(false);
  });
  it('errorMessage usa a mensagem do ApiError', () => {
    expect(errorMessage(new ApiError('Horário ocupado.', 409), 'Falhou.')).toBe('Horário ocupado.');
  });
  it('errorMessage não expõe erros desconhecidos', () => {
    expect(errorMessage(new TypeError('x is undefined'), 'Falhou.')).toBe('Falhou.');
  });
});
