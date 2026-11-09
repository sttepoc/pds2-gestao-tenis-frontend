import type { ReactNode } from 'react';
import type { Booking } from '../api/types';
import { clubDate, clubDateLabel, clubTime, dayParts } from '../lib/club-time';
import { bookingPath } from '../navigation';

const statusLabels = { completed: 'Concluída', cancelled: 'Cancelada' } as const;

export function BookingCard({ booking, children }: { booking: Booking; children?: ReactNode }) {
  const { weekday, day } = dayParts(clubDate(booking.starts_at));
  const confirmed = booking.participants.filter((item) => item.attendance === 'confirmed').length;
  const role = booking.my_role === 'organizer' ? 'Organizador' : `Convidado por ${booking.organizer.name}`;
  const status = booking.status === 'active' ? null : statusLabels[booking.status];
  return (
    <article className="booking-card">
      <div className="booking-date" aria-hidden="true">
        <span>{weekday}</span>
        <strong>{day}</strong>
      </div>
      <div className="booking-info">
        <h3>
          <a className="booking-link" href={bookingPath(booking.id)}>
            {booking.court.name} · {clubTime(booking.starts_at)}–{clubTime(booking.ends_at)}
          </a>
        </h3>
        <p className="booking-meta">
          <time className="visually-hidden" dateTime={booking.starts_at}>{clubDateLabel(booking.starts_at)}</time>
          <span className="booking-badge">{role}</span>
          {status && <span className={`booking-badge booking-badge--${booking.status}`}>{status}</span>}
          <span>{confirmed} de {booking.participants.length} confirmaram</span>
        </p>
        {children && <div className="booking-actions">{children}</div>}
      </div>
    </article>
  );
}
