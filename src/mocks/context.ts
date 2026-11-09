import { ApiError } from '../api/error';
import type { Attendance, Court, Member } from '../api/types';
import { initialAccounts, initialClubData, initialMembers, MOCK_DATA_KEY, type MockAccount } from './fixtures';

export type MockSession = { token: string; userId: number; expiresAt: string };
export type MockBooking = {
  id: number;
  court_id: number;
  starts_at: string;
  ends_at: string;
  status: 'active' | 'cancelled';
  organizer_id: number;
  participants: { user_id: number; attendance: Attendance }[];
};
export type MockWaitlistEntry = {
  id: number;
  user_id: number;
  court_id: number;
  starts_at: string;
  created_at: string;
  offer_expires_at: string | null;
};
export type Database = {
  accounts: MockAccount[];
  members: Member[];
  sessions: MockSession[];
  courts: Court[];
  bookings: MockBooking[];
  waitlist: MockWaitlistEntry[];
  nextUserId: number;
  nextMemberId: number;
  nextId: number;
};
export type MockOptions = { delayMs?: number; scenario?: string; storage?: Pick<Storage, 'getItem' | 'setItem'>; now?: () => number };

// Os handlers só mutam propriedades de ctx.db, nunca reatribuem ctx.db.
export type MockContext = {
  db: Database;
  now: () => number;
  scenario: string;
  persist(): void;
  /** `members` liga o cenário `members-error`, que só afeta as rotas de membros. */
  wait(members?: boolean): Promise<void>;
  authenticate(token: string, admin?: boolean): MockAccount;
};

function isDatabase(value: unknown): value is Database {
  const db = value as Partial<Database> | null;
  return !!db && typeof db === 'object' &&
    [db.accounts, db.members, db.sessions, db.courts, db.bookings, db.waitlist].every(Array.isArray) &&
    [db.nextUserId, db.nextMemberId, db.nextId].every(Number.isInteger);
}

function loadDatabase(storage: MockOptions['storage']): Database | null {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(MOCK_DATA_KEY) ?? 'null');
    return isDatabase(parsed) ? parsed : null;
  } catch {
    return null; // Dados inválidos ou armazenamento indisponível: usa fixtures.
  }
}

export function createMockContext({ delayMs = 450, scenario = 'success', storage, now = Date.now }: MockOptions = {}): MockContext {
  const ctx: MockContext = {
    db: loadDatabase(storage) ?? {
      accounts: initialAccounts(),
      members: scenario === 'empty' ? [] : initialMembers(),
      sessions: [],
      ...initialClubData(now()),
      nextUserId: 6,
      nextMemberId: 4,
    },
    now,
    scenario,
    persist() {
      try { storage?.setItem(MOCK_DATA_KEY, JSON.stringify(ctx.db)); } catch { /* Continua em memória. */ }
    },
    async wait(members = false) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (ctx.scenario === 'error' || (members && ctx.scenario === 'members-error')) throw new ApiError('Falha simulada no servidor. Tente novamente.', 500);
      if (ctx.scenario === 'offline') throw new ApiError('Não foi possível falar com o servidor do clube. Tente de novo em instantes.', 0);
      if (ctx.scenario === 'rate-limit') throw new ApiError('Muitas tentativas seguidas. Tente de novo em 60 segundos.', 429);
    },
    authenticate(token, admin = false) {
      const session = ctx.db.sessions.find((item) => item.token === token && Date.parse(item.expiresAt) > ctx.now());
      const account = session && ctx.db.accounts.find((item) => item.user.id === session.userId);
      if (!account || ctx.scenario === 'expired') throw new ApiError('Autenticação necessária ou sessão inválida.', 401);
      if (admin && !account.admin) throw new ApiError('Acesso restrito a administradores.', 403);
      return account;
    },
  };
  return ctx;
}
