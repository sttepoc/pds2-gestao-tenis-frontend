import { useRef, useState } from 'react';
import { respondAttendance } from '../api/bookings';
import { errorMessage, isExpired } from '../api/error';
import type { Booking, Session } from '../api/types';

type Props = {
  booking: Booking;
  session: Session;
  onChange: (booking: Booking) => void;
  onExpired: () => void;
};

export function AttendanceActions({ booking, session, onChange, onExpired }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const mine = booking.participants.find((item) => item.id === session.user.id);
  // Quem decide se já começou é o servidor (422); 'completed' e 'cancelled' já chegam marcadas.
  if (booking.my_role !== 'participant' || !mine || booking.status !== 'active') return null;

  async function respond(response: 'confirmed' | 'declined') {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      onChange(await respondAttendance(session.token, booking.id, response));
    } catch (failure) {
      if (isExpired(failure)) return onExpired();
      setError(errorMessage(failure, 'Não foi possível registrar sua resposta.'));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="attendance-actions">
      {mine.attendance === 'confirmed' && <p className="attendance-state" role="status">Presença confirmada</p>}
      {mine.attendance === 'declined' && <p className="attendance-state" role="status">Você avisou que não vai</p>}
      <div className="attendance-buttons">
        {mine.attendance !== 'confirmed' && (
          <button className="button" type="button" disabled={busy} onClick={() => respond('confirmed')}>Confirmar presença</button>
        )}
        {mine.attendance !== 'declined' && (
          <button className="button button--secondary" type="button" disabled={busy} onClick={() => respond('declined')}>Não vou</button>
        )}
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
    </div>
  );
}
