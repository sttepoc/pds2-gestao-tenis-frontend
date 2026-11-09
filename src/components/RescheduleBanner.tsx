import type { Booking } from '../api/types';
import { formatClubDateTime } from '../lib/club-time';
import { bookingPath } from '../navigation';

export function RescheduleBanner({ booking }: { booking: Booking }) {
  return (
    <div className="reschedule-banner" role="region" aria-label="Remarcação em andamento">
      <p>Escolha o novo horário para {booking.court.name} · {formatClubDateTime(booking.starts_at)}</p>
      <a className="text-link" href={bookingPath(booking.id)}>Cancelar remarcação</a>
    </div>
  );
}
