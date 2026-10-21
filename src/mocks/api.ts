import { ApiError } from '../api/error';
import type { ApiServices, Member, MemberQuery } from '../api/types';
import { DEMO_PASSWORD, initialAccounts, initialMembers, MOCK_DATA_KEY, type MockAccount } from './fixtures';
import { validateLogin, validateMember, validateRegistration } from './validation';

type MockSession = { token: string; userId: number; expiresAt: string };
type Database = { accounts: MockAccount[]; members: Member[]; sessions: MockSession[]; nextUserId: number; nextMemberId: number };
type Options = { delayMs?: number; scenario?: string; storage?: Pick<Storage, 'getItem' | 'setItem'>; now?: () => number };

export function createMockApi({ delayMs = 450, scenario = 'success', storage, now = Date.now }: Options = {}): ApiServices {
  let db: Database = { accounts: initialAccounts(), members: scenario === 'empty' ? [] : initialMembers(), sessions: [], nextUserId: 3, nextMemberId: 4 };
  try {
    const raw = storage?.getItem(MOCK_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (Array.isArray(parsed.accounts) && Array.isArray(parsed.members) && Array.isArray(parsed.sessions) &&
        Number.isInteger(parsed.nextUserId) && Number.isInteger(parsed.nextMemberId)) db = parsed;
    }
  } catch { /* Dados inválidos ou armazenamento indisponível: usa fixtures. */ }
  function persist() {
    try { storage?.setItem(MOCK_DATA_KEY, JSON.stringify(db)); } catch { /* Continua em memória. */ }
  }
  async function wait(members = false) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (scenario === 'error' || (members && scenario === 'members-error')) throw new ApiError('Falha simulada no servidor. Tente novamente.', 500);
    if (scenario === 'offline') throw new ApiError('Não foi possível falar com o servidor do clube. Tente de novo em instantes.', 0);
    if (scenario === 'rate-limit') throw new ApiError('Muitas tentativas seguidas. Tente de novo em 60 segundos.', 429);
  }
  function authenticate(token: string, admin = false) {
    const session = db.sessions.find((item) => item.token === token && Date.parse(item.expiresAt) > now());
    const account = session && db.accounts.find((item) => item.user.id === session.userId);
    if (!account || scenario === 'expired') throw new ApiError('Autenticação necessária ou sessão inválida.', 401);
    if (admin && !account.admin) throw new ApiError('Acesso restrito a administradores.', 403);
    return account;
  }
  async function memberAccess(token: string) {
    await wait(true);
    authenticate(token, true);
  }
  function findMember(id: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError('Identificador inválido.', 422);
    const member = db.members.find((item) => item.id === id);
    if (!member) throw new ApiError('Membro não encontrado.', 404);
    return member;
  }
  function uniqueEmail(email: string | undefined, id?: number) {
    if (email && db.members.some((item) => item.email === email && item.id !== id)) {
      const message = 'Este e-mail já está cadastrado para outro membro.';
      throw new ApiError(message, 409, { email: [message] });
    }
  }
  async function hash(password: string) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  function pagination(query: MemberQuery) {
    const { page = 1, page_size = 20 } = query;
    if (!Number.isInteger(page) || page < 1 || page > 2147483647 ||
      !Number.isInteger(page_size) || page_size < 1 || page_size > 100 ||
      (query.q !== undefined && (typeof query.q !== 'string' || Array.from(query.q).length > 120)) ||
      (query.status !== undefined && !['active', 'inactive'].includes(query.status))) {
      throw new ApiError('Filtros ou paginação inválidos.', 422);
    }
    return { page, page_size };
  }

  return {
    async login(email, password) {
      await wait();
      const normalized = validateLogin(email, password);
      const account = db.accounts.find((item) => item.user.email === normalized);
      const matches = account?.passwordHash ? account.passwordHash === await hash(password) : password === DEMO_PASSWORD;
      if (!account || !matches) throw new ApiError('E-mail ou senha inválidos.', 401);
      const session = { token: `mock-${crypto.randomUUID()}`, userId: account.user.id, expiresAt: new Date(now() + 3600000).toISOString() };
      db.sessions = db.sessions.filter((item) => Date.parse(item.expiresAt) > now());
      db.sessions.push(session);
      persist();
      return { token: session.token, expiresAt: session.expiresAt, user: { ...account.user } };
    },
    async fetchCurrentUser(token) {
      await wait();
      return { ...authenticate(token).user };
    },
    async logout(token) {
      await wait();
      authenticate(token);
      db.sessions = db.sessions.filter((item) => item.token !== token);
      persist();
    },
    async register(input) {
      await wait();
      const { name, email, password } = validateRegistration(input);
      const passwordHash = await hash(password);
      if (db.accounts.some((item) => item.user.email === email)) {
        const message = 'Este e-mail já está cadastrado.';
        throw new ApiError(message, 422, { email: [message] });
      }
      const user = { id: db.nextUserId++, name, email, created_at: new Date(now()).toISOString() };
      db.accounts.push({ user, admin: false, passwordHash });
      persist();
      return { ...user };
    },
    async listMembers(token, query = {}) {
      await memberAccess(token);
      const { page, page_size } = pagination(query);
      const q = query.q?.trim().toLowerCase() ?? '';
      const members = db.members.filter((item) =>
        (!query.status || item.status === query.status) &&
        (item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q)),
      ).sort((a, b) => a.id - b.id);
      return {
        data: members.slice((page - 1) * page_size, page * page_size).map((item) => ({ ...item })),
        meta: { page, page_size, total: members.length, total_pages: Math.ceil(members.length / page_size) },
      };
    },
    async getMember(token, id) {
      await memberAccess(token);
      return { ...findMember(id) };
    },
    async createMember(token, input) {
      await memberAccess(token);
      const values = validateMember(input);
      uniqueEmail(values.email);
      const timestamp = new Date(now()).toISOString();
      const member: Member = { id: db.nextMemberId++, name: values.name!, email: values.email!, phone: values.phone ?? null, status: values.status ?? 'active', created_at: timestamp, updated_at: timestamp };
      db.members.push(member);
      persist();
      return { ...member };
    },
    async updateMember(token, id, input) {
      await memberAccess(token);
      const values = validateMember(input, true);
      const member = findMember(id);
      uniqueEmail(values.email, id);
      Object.assign(member, values, { updated_at: new Date(now()).toISOString() });
      persist();
      return { ...member };
    },
    async deleteMember(token, id) {
      await memberAccess(token);
      findMember(id);
      db.members = db.members.filter((item) => item.id !== id);
      persist();
    },
  };
}
