import type { Member, User } from '../api/types';

export const DEMO_PASSWORD = 'SenhaSegura123';
export const DEMO_ADMIN_EMAIL = 'admin@clube.example';
export const DEMO_USER_EMAIL = 'usuario@clube.example';
export const MOCK_DATA_KEY = 'clube-tenis.mock-data.v1';
const created_at = '2026-01-01T12:00:00.000Z';

// As permissões pertencem ao simulador; não fazem parte de UserResponse da API atual.
export type MockAccount = { user: User; admin: boolean; passwordHash?: string };
export function initialAccounts(): MockAccount[] {
  return [
    { user: { id: 1, name: 'Ana Administradora', email: DEMO_ADMIN_EMAIL, created_at }, admin: true },
    { user: { id: 2, name: 'Bruno Usuário', email: DEMO_USER_EMAIL, created_at }, admin: false },
  ];
}

export function initialMembers(): Member[] {
  return [
    { name: 'Mariana Silva', email: 'mariana@clube.example', phone: '+55 (31) 99999-1234', status: 'active' },
    { name: 'Pedro Santos', email: 'pedro@clube.example', phone: null, status: 'inactive' },
    { name: 'Camila Oliveira', email: 'camila@clube.example', phone: '(11) 98888-4321', status: 'active' },
  ].map((member, index) => ({ ...member, status: member.status as Member['status'], id: index + 1, created_at, updated_at: created_at }));
}
