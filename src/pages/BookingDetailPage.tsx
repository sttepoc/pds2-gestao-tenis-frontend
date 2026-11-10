import { useState } from 'react';
import { findBooking } from '../api/bookings';
import type { Session } from '../api/types';
import { AttendanceActions } from '../components/AttendanceActions';
import { AttendanceList } from '../components/AttendanceList';
import { CancelBookingAction } from '../components/CancelBookingAction';
import { BackToBookings, BookingUnavailable, Loading } from '../components/LoadStatus';
import { RescheduleLink } from '../components/RescheduleLink';
import { useLoad } from '../hooks/useLoad';
import { clubDateLabel, clubTime } from '../lib/club-time';

type Props = {
  id: number;
  session: Session;
  onExpired: () => void;
  now?: () => number;
};

const statusLabels = { completed: 'Concluída', cancelled: 'Cancelada' } as const;

export function BookingDetailPage({ id, session, onExpired, now }: Props) {
  const { state, reload, setData } = useLoad(`booking:${id}`, () => findBooking(session.token, id), onExpired);
  const [notice, setNotice] = useState('');

  if (state.status === 'loading') return <Loading>Carregando reserva…</Loading>;
  if (state.status === 'error') return <BookingUnavailable error={state.message} onRetry={reload} />;
  if (state.data === null) return <BookingUnavailable />;
  const booking = state.data;
  const confirmed = booking.participants.filter((item) => item.attendance === 'confirmed').length;
  const role = booking.my_role === 'organizer' ? 'Organizador' : `Convidado por ${booking.organizer.name}`;
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Sua reserva</p>
        <h1>{booking.court.name}</h1>
      </div>
      <section className="content-panel" aria-label="Detalhes da reserva">
        <p className="booking-meta">
          <time dateTime={booking.starts_at}>{clubDateLabel(booking.starts_at)}</time>
          <span>{clubTime(booking.starts_at)}–{clubTime(booking.ends_at)}</span>
        </p>
        <p className="booking-meta">
          <span className="booking-badge">{role}</span>
          {booking.status !== 'active' && (
            <span className={`booking-badge booking-badge--${booking.status}`}>{statusLabels[booking.status]}</span>
          )}
          <span>{confirmed} de {booking.participants.length} confirmaram</span>
        </p>
        {notice && <p className="notice" role="status">{notice}</p>}
        <div className="booking-actions booking-actions--detail">
          <AttendanceActions booking={booking} session={session} onChange={setData} onExpired={onExpired} now={now} />
          <RescheduleLink booking={booking} now={now} />
          <CancelBookingAction
            booking={booking} session={session} onExpired={onExpired} now={now}
            onCancelled={(cancelled) => { setData(cancelled); setNotice('Reserva cancelada.'); }}
          />
        </div>
        <AttendanceList participants={booking.participants} />
      </section>
      <BackToBookings />
    </>
  );
}
