import { getApi } from './client';
import type { RegisterInput } from './types';

// Mantém os imports do formulário existente compatíveis.
export { ApiError } from './error';
export type { Session, User } from './types';

export async function login(email: string, password: string) {
  return (await getApi()).login(email, password);
}
export async function fetchCurrentUser(token: string) {
  return (await getApi()).fetchCurrentUser(token);
}
export async function logout(token: string) {
  return (await getApi()).logout(token);
}
export async function register(input: RegisterInput) {
  return (await getApi()).register(input);
}
