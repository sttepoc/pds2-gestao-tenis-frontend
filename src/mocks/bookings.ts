import { ApiError } from '../api/error';
import type { ApiServices, Booking, BookingInput } from '../api/types';
import { clubDate, clubTime, nextClubDays } from '../lib/club-time';
import type { MockBooking, MockContext } from './context';
import { slotState } from './schedule';

const KEYS = ['court_id', 'starts_at', 'participant_ids'];
const RESCHEDULE_KEYS = ['court_id', 'starts_at'];
const HOUR = 3600000;
const MAX_GUESTS = 3;

function invalid(field: string, message: string): never {
  throw new ApiError('Os dados informados são inválidos.', 422, { [field]: [message] });
}

/** Reserva no formato da API, vista por `viewerId`. */
export function toBooking(ctx: MockContext, mock: MockBooking, viewerId: number): Booking {
  const nameOf = (id: number) => ctx.db.accounts.find((item) => item.user.id === id)?.user.name ?? 'Jogador';
  const court = ctx.db.courts.find((item) => item.id === mock.court_id);
  return {
    id: mock.id,
    court: { id: mock.court_id, name: court?.name ?? 'Quadra' },
    starts_at: mock.starts_at,
    ends_at: mock.ends_at,
    status: mock.status,
    organizer: { id: mock.organizer_id, name: nameOf(mock.organizer_id) },
    participants: mock.participants.map((item) => ({ id: item.user_id, name: nameOf(item.user_id), attendance: item.attendance })),
    my_role: mock.organizer_id === viewerId ? 'organizer' : 'participant',
  };
}

// Ativa que já terminou aparece como concluída, sem gravar isso no banco.
function withStatus(ctx: MockContext, mock: MockBooking, viewerId: number): Booking {
  const booking = toBooking(ctx, mock, viewerId);
  if (mock.status === 'active' && Date.parse(mock.ends_at) <= ctx.now()) booking.status = 'completed';
  return booking;
}

const isMine = (mock: MockBooking, viewerId: number) =>
  mock.organizer_id === viewerId || mock.participants.some((item) => item.user_id === viewerId);

/** Valida quadra e horário de um pedido (criar ou remarcar), até "já passou". */
function parseSlot(ctx: MockContext, input: object, keys: string[]) {
  const { court_id, starts_at } = input as Partial<Record<'court_id' | 'starts_at', unknown>>;
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) invalid(key, 'Este campo não pode ser informado.');
  }
  const court = Number.isSafeInteger(court_id) ? ctx.db.courts.find((item) => item.id === court_id) : undefined;
  if (!court) invalid('court_id', 'Escolha uma quadra válida.');
  const start = typeof starts_at === 'string' ? Date.parse(starts_at) : NaN;
  if (Number.isNaN(start)) invalid('starts_at', 'Escolha um horário válido.');
  const iso = new Date(start).toISOString();
  const time = clubTime(iso);
  if (!nextClubDays(ctx.now(), 7).includes(clubDate(start)) || time < '07:00' || time > '21:00' || !time.endsWith(':00')) {
    invalid('starts_at', 'Esse horário está fora da agenda.');
  }
  if (start <= ctx.now()) throw new ApiError('Esse horário já passou.', 422, { starts_at: ['Esse horário já passou.'] });
  return { court, start, iso };
}

function assertFree(ctx: MockContext, courtId: number, iso: string, viewerId: number) {
  const state = slotState(ctx, courtId, iso, viewerId);
  if (state.status === 'maintenance') throw new ApiError('Essa quadra está em manutenção nesse horário.', 409);
  if (state.status !== 'free') throw new ApiError('Esse horário acabou de ser reservado por outra pessoa.', 409);
}

/** Gancho para quando um horário volta a ficar livre; a Task 13 passa a oferecê-lo à fila de espera. */
export function releaseSlot(_ctx: MockContext, _courtId: number, _startsAt: string): void {}

export function bookingHandlers(ctx: MockContext): Pick<ApiServices, 'searchPlayers' | 'createBooking' | 'listBookings' | 'getBooking' | 'respondAttendance' | 'cancelBooking' | 'rescheduleBooking'> {
  return {
    async listBookings(token, scope) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      if (scope !== 'upcoming' && scope !== 'past') invalid('scope', 'Escopo inválido.');
      const now = ctx.now();
      const mine = ctx.db.bookings.filter((item) => isMine(item, viewer.id));
      const upcoming = (item: MockBooking) => item.status === 'active' && Date.parse(item.ends_at) > now;
      const chosen = scope === 'upcoming'
        ? mine.filter(upcoming).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
        : mine.filter((item) => !upcoming(item)).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
      return chosen.map((item) => withStatus(ctx, item, viewer.id));
    },
    async getBooking(token, id) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      const found = Number.isSafeInteger(id) ? ctx.db.bookings.find((item) => item.id === id) : undefined;
      // Mesma resposta para inexistente, inválida e de outra pessoa.
      if (!found || !isMine(found, viewer.id)) throw new ApiError('Reserva não encontrada.', 404);
      return withStatus(ctx, found, viewer.id);
    },
    async respondAttendance(token, id, response) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      const found = Number.isSafeInteger(id) ? ctx.db.bookings.find((item) => item.id === id) : undefined;
      if (!found || !isMine(found, viewer.id)) throw new ApiError('Reserva não encontrada.', 404);
      if (found.organizer_id === viewer.id) throw new ApiError('Quem organiza já está confirmado.', 403);
      if (response !== 'confirmed' && response !== 'declined') invalid('response', 'Resposta inválida.');
      if (found.status !== 'active' || Date.parse(found.starts_at) <= ctx.now()) {
        throw new ApiError('Essa reserva já começou ou foi cancelada.', 422);
      }
      const mine = found.participants.find((item) => item.user_id === viewer.id);
      if (mine) mine.attendance = response;
      ctx.persist();
      return toBooking(ctx, found, viewer.id);
    },
    async cancelBooking(token, id) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      const found = Number.isSafeInteger(id) ? ctx.db.bookings.find((item) => item.id === id) : undefined;
      if (!found || !isMine(found, viewer.id)) throw new ApiError('Reserva não encontrada.', 404);
      if (found.organizer_id !== viewer.id) throw new ApiError('Só quem organiza pode cancelar a reserva.', 403);
      if (found.status !== 'active' || Date.parse(found.starts_at) <= ctx.now()) {
        throw new ApiError('Essa reserva já começou ou foi cancelada.', 422);
      }
      found.status = 'cancelled';
      ctx.persist();
      releaseSlot(ctx, found.court_id, found.starts_at);
      return toBooking(ctx, found, viewer.id);
    },
    async rescheduleBooking(token, id, input) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      const found = Number.isSafeInteger(id) ? ctx.db.bookings.find((item) => item.id === id) : undefined;
      if (!found || !isMine(found, viewer.id)) throw new ApiError('Reserva não encontrada.', 404);
      if (found.organizer_id !== viewer.id) throw new ApiError('Só quem organiza pode remarcar a reserva.', 403);
      if (found.status !== 'active' || Date.parse(found.starts_at) <= ctx.now()) {
        throw new ApiError('Essa reserva já começou ou foi cancelada.', 422);
      }
      if (ctx.scenario === 'conflict') throw new ApiError('Esse horário acabou de ser reservado por outra pessoa.', 409);
      const { court, start, iso } = parseSlot(ctx, input, RESCHEDULE_KEYS);
      if (court.id === found.court_id && start === Date.parse(found.starts_at)) {
        throw new ApiError('Escolha um horário diferente do atual.', 422, { starts_at: ['Escolha um horário diferente do atual.'] });
      }
      assertFree(ctx, court.id, iso, viewer.id);
      const previous = { court_id: found.court_id, starts_at: found.starts_at };
      found.court_id = court.id;
      found.starts_at = iso;
      found.ends_at = new Date(start + HOUR).toISOString();
      for (const item of found.participants) {
        if (item.user_id !== found.organizer_id) item.attendance = 'pending';
      }
      ctx.persist();
      releaseSlot(ctx, previous.court_id, previous.starts_at);
      return toBooking(ctx, found, viewer.id);
    },
    async searchPlayers(token, q) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      const size = typeof q === 'string' ? Array.from(q.trim()).length : 0;
      if (size < 2 || size > 60) invalid('q', 'Digite de 2 a 60 caracteres para buscar.');
      const term = q.trim().toLowerCase();
      return ctx.db.accounts
        .filter((item) => item.user.id !== viewer.id && item.user.name.toLowerCase().includes(term))
        .slice(0, 10)
        .map((item) => ({ id: item.user.id, name: item.user.name }));
    },
    async createBooking(token, input: BookingInput) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      if (ctx.scenario === 'conflict') throw new ApiError('Esse horário acabou de ser reservado por outra pessoa.', 409);
      const { court, start, iso } = parseSlot(ctx, input, KEYS);
      assertFree(ctx, court.id, iso, viewer.id);

      const ids = input.participant_ids;
      if (!Array.isArray(ids) || ids.length > MAX_GUESTS) invalid('participant_ids', 'Convide até 3 jogadores.');
      if (new Set(ids).size !== ids.length) invalid('participant_ids', 'Há jogadores repetidos.');
      for (const id of ids) {
        if (!ctx.db.accounts.some((item) => item.user.id === id)) invalid('participant_ids', 'Jogador não encontrado.');
        if (id === viewer.id) invalid('participant_ids', 'Você já participa da reserva.');
      }
      const booking: MockBooking = {
        id: ctx.db.nextId++, court_id: court.id, starts_at: iso, ends_at: new Date(start + HOUR).toISOString(),
        status: 'active', organizer_id: viewer.id,
        participants: [
          { user_id: viewer.id, attendance: 'confirmed' },
          ...ids.map((user_id) => ({ user_id, attendance: 'pending' as const })),
        ],
      };
      ctx.db.bookings.push(booking);
      ctx.persist();
      return toBooking(ctx, booking, viewer.id);
    },
  };
}
