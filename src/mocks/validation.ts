import { ApiError } from '../api/error';
import type { CreateMemberInput, RegisterInput, UpdateMemberInput } from '../api/types';

type Fields = Record<string, unknown>;
const length = (value: string) => Array.from(value).length;

function invalid(field: string, message: string): never {
  throw new ApiError('Os dados informados são inválidos.', 422, { [field]: [message] });
}
function checkKeys(input: object, allowed: string[]) {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) invalid(key, 'Este campo não pode ser informado.');
  }
}
function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || length(value.trim()) > max) {
    invalid(field, `Informe um texto de 1 a ${max} caracteres.`);
  }
  return value.trim();
}
export function normalizeEmail(value: unknown): string {
  const email = text(value, 'email', 254).toLowerCase();
  // Validação local básica; a validação completa de EmailStr permanece no backend.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('email', 'Informe um e-mail válido.');
  return email;
}
export function validateLogin(email: string, password: string) {
  const normalized = normalizeEmail(email);
  if (typeof password !== 'string' || length(password) < 1 || length(password) > 128) {
    invalid('password', 'Informe uma senha de 1 a 128 caracteres.');
  }
  return normalized;
}
export function validateRegistration(input: RegisterInput) {
  checkKeys(input, ['name', 'email', 'password', 'password_confirmation']);
  const name = text(input.name, 'name', 120);
  const email = normalizeEmail(input.email);
  const password = input.password;
  if (typeof password !== 'string' || length(password) < 12 || length(password) > 128 ||
    !/\p{Lu}/u.test(password) || !/\p{Ll}/u.test(password) || !/\p{Nd}/u.test(password)) {
    invalid('password', 'Use de 12 a 128 caracteres, com letras maiúsculas, minúsculas e números.');
  }
  if (input.password_confirmation !== password) invalid('password_confirmation', 'A confirmação de senha não confere.');
  return { name, email, password };
}
export function validateMember(input: CreateMemberInput | UpdateMemberInput, partial = false): UpdateMemberInput {
  checkKeys(input, ['name', 'email', 'phone', 'status']);
  if (partial && !Object.keys(input).length) invalid('body', 'Informe ao menos um campo para atualizar.');
  const values = input as Fields;
  const result: UpdateMemberInput = {};
  if (!partial || 'name' in input) result.name = text(values.name, 'name', 120);
  if (!partial || 'email' in input) result.email = normalizeEmail(values.email);
  if ('phone' in input) {
    const phone = values.phone === null ? null : typeof values.phone === 'string' ? values.phone.trim() || null : undefined;
    const digits = phone?.replace(/\D/g, '').length ?? 0;
    if (phone === undefined || (phone !== null && (length(phone) > 32 || !/^\+?[0-9(). -]+$/.test(phone) || digits < 7 || digits > 15))) {
      invalid('phone', 'Informe um telefone com 7 a 15 dígitos e formato válido.');
    }
    result.phone = phone;
  }
  if ('status' in input) {
    if (values.status !== 'active' && values.status !== 'inactive') invalid('status', 'Use active ou inactive.');
    result.status = values.status;
  }
  return result;
}
