import { ApiError } from '../api/error';
import type { ApiServices, Member, MemberQuery } from '../api/types';
import { bookingHandlers } from './bookings';
import { courtHandlers } from './courts';
import { scheduleHandlers } from './schedule';
import { waitlistHandlers } from './waitlist';
import { createMockContext, notYet, type MockContext, type MockOptions } from './context';
import { DEMO_PASSWORD } from './fixtures';
import { validateLogin, validateMember, validateRegistration } from './validation';

// Ainda sem handler: as próximas tasks substituem cada um destes.
const pending = async (): Promise<never> => notYet();

export function createMockApi(options: MockOptions = {}): ApiServices {
  return mockApiFor(createMockContext(options));
}

export function mockApiFor(ctx: MockContext): ApiServices {
  const { persist, wait, authenticate, now } = ctx;
  async function memberAccess(token: string) {
    await wait(true);
    authenticate(token, true);
  }
  function findMember(id: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError('Identificador inválido.', 422);
    const member = ctx.db.members.find((item) => item.id === id);
    if (!member) throw new ApiError('Membro não encontrado.', 404);
    return member;
  }
  function uniqueEmail(email: string | undefined, id?: number) {
    if (email && ctx.db.members.some((item) => item.email === email && item.id !== id)) {
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
      const account = ctx.db.accounts.find((item) => item.user.email === normalized);
      const matches = account?.passwordHash ? account.passwordHash === await hash(password) : password === DEMO_PASSWORD;
      if (!account || !matches) throw new ApiError('E-mail ou senha inválidos.', 401);
      const session = { token: `mock-${crypto.randomUUID()}`, userId: account.user.id, expiresAt: new Date(now() + 3600000).toISOString() };
      ctx.db.sessions = ctx.db.sessions.filter((item) => Date.parse(item.expiresAt) > now());
      ctx.db.sessions.push(session);
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
      ctx.db.sessions = ctx.db.sessions.filter((item) => item.token !== token);
      persist();
    },
    async register(input) {
      await wait();
      const { name, email, password } = validateRegistration(input);
      const passwordHash = await hash(password);
      if (ctx.db.accounts.some((item) => item.user.email === email)) {
        const message = 'Este e-mail já está cadastrado.';
        throw new ApiError(message, 422, { email: [message] });
      }
      const user = { id: ctx.db.nextUserId++, name, email, created_at: new Date(now()).toISOString() };
      ctx.db.accounts.push({ user, admin: false, passwordHash });
      persist();
      return { ...user };
    },
    async listMembers(token, query = {}) {
      await memberAccess(token);
      const { page, page_size } = pagination(query);
      const q = query.q?.trim().toLowerCase() ?? '';
      const members = ctx.db.members.filter((item) =>
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
      const member: Member = { id: ctx.db.nextMemberId++, name: values.name!, email: values.email!, phone: values.phone ?? null, status: values.status ?? 'active', created_at: timestamp, updated_at: timestamp };
      ctx.db.members.push(member);
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
      ctx.db.members = ctx.db.members.filter((item) => item.id !== id);
      persist();
    },
    ...courtHandlers(ctx),
    ...scheduleHandlers(ctx),
    ...bookingHandlers(ctx),
    ...waitlistHandlers(ctx),
    acceptOffer: pending,
    declineOffer: pending,
  };
}
