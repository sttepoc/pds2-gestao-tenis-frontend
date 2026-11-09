import { ApiError } from '../api/error';
import type { ApiServices, Court, Slot } from '../api/types';
import { fromClubLocal, nextClubDays } from '../lib/club-time';
import type { MockContext } from './context';

const HOUR = 3600000;
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Estado de um horário para um jogador. Prioridade: manutenção > mine > booked > free.
 * `booking_id` só vem preenchido quando o horário é do próprio jogador.
 */
export function slotState(ctx: MockContext, courtId: number, startsAt: string, viewerId: number): Slot {
  const start = Date.parse(startsAt);
  const end = start + HOUR;
  const court = ctx.db.courts.find((item) => item.id === courtId);
  const underMaintenance = !!court?.maintenance.some((item) =>
    start < Date.parse(item.ends_at) && Date.parse(item.starts_at) < end);
  const booking = ctx.db.bookings.find((item) =>
    item.status === 'active' && item.court_id === courtId && Date.parse(item.starts_at) === start);
  const queue = ctx.db.waitlist.filter((item) => item.court_id === courtId && Date.parse(item.starts_at) === start);
  const offered = queue.some((item) => item.offer_expires_at !== null && Date.parse(item.offer_expires_at) > ctx.now());
  const isMine = !!booking && (booking.organizer_id === viewerId
    || booking.participants.some((item) => item.user_id === viewerId));

  let status: Slot['status'] = 'free';
  if (underMaintenance) status = 'maintenance';
  else if (isMine) status = 'mine';
  else if (booking || offered) status = 'booked';

  return {
    court_id: courtId,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
    status,
    booking_id: status === 'mine' ? booking!.id : null,
    waitlist_size: queue.length,
    waitlist_entry_id: queue.find((item) => item.user_id === viewerId)?.id ?? null,
  };
}

const copy = (court: Court): Court => ({ ...court, maintenance: court.maintenance.map((item) => ({ ...item })) });

export function scheduleHandlers(ctx: MockContext): Pick<ApiServices, 'getSchedule'> {
  return {
    async getSchedule(token, date) {
      await ctx.wait();
      const viewer = ctx.authenticate(token).user;
      if (typeof date !== 'string' || !DATE_PATTERN.test(date) || !nextClubDays(ctx.now(), 7).includes(date)) {
        throw new ApiError('Escolha uma data entre hoje e os próximos 6 dias.', 422, { date: ['Data fora do período permitido.'] });
      }
      const courts = [...ctx.db.courts].sort((a, b) => a.id - b.id);
      const slots: Slot[] = [];
      for (const court of courts) {
        for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
          const startsAt = new Date(fromClubLocal(`${date}T${String(hour).padStart(2, '0')}:00`)).toISOString();
          slots.push(slotState(ctx, court.id, startsAt, viewer.id));
        }
      }
      return { date, courts: courts.map(copy), slots };
    },
  };
}
