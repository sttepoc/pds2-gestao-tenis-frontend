import { ApiError } from '../api/error';
import type { ApiServices, WaitlistEntry } from '../api/types';
import type { MockContext, MockWaitlistEntry } from './context';
import { slotState } from './schedule';

const KEYS = ['court_id', 'starts_at'];
const HOUR = 3600000;

/** Fila de um horário, por ordem de chegada (empate pelo id). */
export function queueFor(ctx: MockContext, courtId: number, startsAt: string): MockWaitlistEntry[] {
  const start = Date.parse(startsAt);
  return ctx.db.waitlist
    .filter((item) => item.court_id === courtId && Date.parse(item.starts_at) === start)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id);
}

function toEntry(ctx: MockContext, mock: MockWaitlistEntry): WaitlistEntry {
  const court = ctx.db.courts.find((item) => item.id === mock.court_id);
  const start = Date.parse(mock.starts_at);
  const offered = mock.offer_expires_at !== null && Date.parse(mock.offer_expires_at) > ctx.now();
  return {
    id: mock.id,
    court: { id: mock.court_id, name: court?.name ?? 'Quadra' },
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + HOUR).toISOString(),
    position: queueFor(ctx, mock.court_id, mock.starts_at).findIndex((item) => item.id === mock.id) + 1,
    offer: offered ? { expires_at: mock.offer_expires_at! } : null,
  };
}

const notAccepted = () => new ApiError('Esse horário não aceita fila.', 422);

export function waitlistHandlers(ctx: MockContext): Pick<ApiServices, 'listWaitlist' | 'joinWaitlist' | 'leaveWaitlist'> {
  return {
    async listWaitlist(token) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      return ctx.db.waitlist
        .filter((item) => item.user_id === viewer.id && Date.parse(item.starts_at) > ctx.now())
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id - b.id)
        .map((item) => toEntry(ctx, item));
    },
    async joinWaitlist(token, input) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      if (!input || typeof input !== 'object' || Object.keys(input).some((key) => !KEYS.includes(key))) {
        throw new ApiError('Os dados informados são inválidos.', 422);
      }
      const { court_id, starts_at } = input;
      const start = typeof starts_at === 'string' ? Date.parse(starts_at) : NaN;
      if (!Number.isSafeInteger(court_id) || Number.isNaN(start) || start <= ctx.now()) throw notAccepted();
      const iso = new Date(start).toISOString();
      if (slotState(ctx, court_id, iso, viewer.id).status !== 'booked') throw notAccepted();
      if (queueFor(ctx, court_id, iso).some((item) => item.user_id === viewer.id)) {
        throw new ApiError('Você já está na fila desse horário.', 409);
      }
      const entry: MockWaitlistEntry = {
        id: ctx.db.nextId++, user_id: viewer.id, court_id, starts_at: iso,
        created_at: new Date(ctx.now()).toISOString(), offer_expires_at: null,
      };
      ctx.db.waitlist.push(entry);
      ctx.persist();
      return toEntry(ctx, entry);
    },
    async leaveWaitlist(token, id) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      const found = Number.isSafeInteger(id)
        ? ctx.db.waitlist.find((item) => item.id === id && item.user_id === viewer.id) : undefined;
      if (!found) throw new ApiError('Entrada não encontrada.', 404);
      ctx.db.waitlist = ctx.db.waitlist.filter((item) => item !== found);
      ctx.persist();
    },
  };
}
