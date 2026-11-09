import type { Booking } from '../api/types';
import { clubDateLabel, clubTime } from '../lib/club-time';
import { reschedulePath } from '../navigation';

type Props = { booking: Booking; now?: () => number };

export function RescheduleLink({ booking, now = Date.now }: Props) {
  // Em andamento ainda vem como ativa; o servidor também confere (422).
  if (booking.my_role !== 'organizer' || booking.status !== 'active' || Date.parse(booking.starts_at) <= now()) return null;
  return (
    <a
      className="button button--secondary" href={reschedulePath(booking.id)}
      aria-label={`Remarcar reserva da ${booking.court.name} em ${clubDateLabel(booking.starts_at)} ${clubTime(booking.starts_at)}`}
    >
      Remarcar
    </a>
  );
}
