import { getBooking } from '../api/bookings';
import { ApiError } from '../api/error';
import type { Session } from '../api/types';
import { AttendanceActions } from '../components/AttendanceActions';
import { AttendanceList } from '../components/AttendanceList';
import { useLoad } from '../hooks/useLoad';
import { clubDateLabel, clubTime } from '../lib/club-time';
import { routePaths } from '../navigation';

type Props = {
  id: number;
  session: Session;
  onExpired: () => void;
};

const statusLabels = { completed: 'Concluída', cancelled: 'Cancelada' } as const;

export function BookingDetailPage({ id, session, onExpired }: Props) {
  // 404 vira null (reserva inexistente ou de outra pessoa); o resto segue para o useLoad.
  const loadBooking = () => getBooking(session.token, id).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  const { state, reload, setData } = useLoad(`booking:${id}`, loadBooking, onExpired);
  const back = <a className="text-link" href={routePaths.bookings}><span aria-hidden="true">←</span> Minhas reservas</a>;

  if (state.status === 'loading') {
    return <p className="status-line" role="status"><span className="rally" aria-hidden="true" />Carregando reserva…</p>;
  }
  if (state.status === 'error') {
    return (
      <>
        <section className="content-panel empty-panel">
          <h1>Não foi possível abrir a reserva</h1>
          <p className="alert" role="alert">{state.message}</p>
          <button className="button button--secondary" type="button" onClick={reload}>Tentar novamente</button>
        </section>
        {back}
      </>
    );
  }
  if (state.data === null) {
    return (
      <>
        <section className="content-panel empty-panel">
          <h1>Reserva não encontrada</h1>
          <p>Ela pode ter sido removida ou não ser sua.</p>
        </section>
        {back}
      </>
    );
  }
  const booking = state.data;
  const confirmed = booking.participants.filter((item) => item.attendance === 'confirmed').length;
  const role = booking.my_role === 'organizer' ? 'Organizador' : `Convidado por ${booking.organizer.name}`;
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">SUA RESERVA</p>
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
        <AttendanceActions booking={booking} session={session} onChange={setData} onExpired={onExpired} />
        <AttendanceList participants={booking.participants} />
      </section>
      {back}
    </>
  );
}
