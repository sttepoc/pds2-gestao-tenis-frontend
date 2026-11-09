import { ApiError } from '../api/error';
import type { ApiServices, WaitlistEntry } from '../api/types';
import { releaseSlot, toBooking } from './bookings';
import type { MockBooking, MockContext, MockWaitlistEntry } from './context';
import { queueFor, slotState } from './schedule';

// queueFor mora em schedule.ts para bookings.ts usá-la sem importar este módulo.
export { queueFor };

const KEYS = ['court_id', 'starts_at'];
const HOUR = 3600000;

/** Tira as entradas da fila e oferece cada horário liberado ao próximo. */
function removeEntries(ctx: MockContext, gone: MockWaitlistEntry[]) {
  ctx.db.waitlist = ctx.db.waitlist.filter((item) => !gone.includes(item));
  ctx.persist();
  for (const item of gone) releaseSlot(ctx, item.court_id, item.starts_at);
}

/**
 * Ofertas vencidas saem da fila e a vaga passa ao próximo; entradas de horários que já começaram somem.
 * Roda antes de cada chamada autenticada (ver api.ts) e só grava quando muda algo.
 */
export function advanceOffers(ctx: MockContext): void {
  const now = ctx.now();
  const gone = ctx.db.waitlist.filter((item) => Date.parse(item.starts_at) <= now
    || (item.offer_expires_at !== null && Date.parse(item.offer_expires_at) <= now));
  if (gone.length > 0) removeEntries(ctx, gone);
}

function ownEntry(ctx: MockContext, viewerId: number, id: number) {
  const found = Number.isSafeInteger(id)
    ? ctx.db.waitlist.find((item) => item.id === id && item.user_id === viewerId) : undefined;
  // Mesma resposta para inexistente, inválida e de outra pessoa.
  if (!found) throw new ApiError('Entrada não encontrada.', 404);
  return found;
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

export function waitlistHandlers(ctx: MockContext): Pick<ApiServices, 'listWaitlist' | 'joinWaitlist' | 'leaveWaitlist' | 'acceptOffer' | 'declineOffer'> {
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
      // Quem sai com oferta pendente passa a vaga adiante.
      removeEntries(ctx, [ownEntry(ctx, viewer.id, id)]);
    },
    // Acham a entrada antes de avançar as ofertas: a própria oferta vencida responde 409, não 404.
    async acceptOffer(token, id) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      const found = ownEntry(ctx, viewer.id, id);
      advanceOffers(ctx);
      // Depois de avançar, entrada que ficou na fila com oferta é oferta vigente de horário futuro.
      if (!ctx.db.waitlist.includes(found) || found.offer_expires_at === null) {
        throw new ApiError('Essa oferta expirou.', 409);
      }
      const start = Date.parse(found.starts_at);
      const booking: MockBooking = {
        id: ctx.db.nextId++, court_id: found.court_id, starts_at: new Date(start).toISOString(),
        ends_at: new Date(start + HOUR).toISOString(), status: 'active', organizer_id: viewer.id,
        participants: [{ user_id: viewer.id, attendance: 'confirmed' }],
      };
      ctx.db.bookings.push(booking);
      ctx.db.waitlist = ctx.db.waitlist.filter((item) => item !== found);
      ctx.persist();
      return toBooking(ctx, booking, viewer.id);
    },
    async declineOffer(token, id) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      const found = ownEntry(ctx, viewer.id, id);
      advanceOffers(ctx);
      // Oferta que venceu agora já saiu e passou adiante: recusar não tem mais o que fazer.
      if (ctx.db.waitlist.includes(found)) removeEntries(ctx, [found]);
    },
  };
}
