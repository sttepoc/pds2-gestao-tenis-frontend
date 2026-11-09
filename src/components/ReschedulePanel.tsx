import { useRef, useState, useTransition, type FormEvent } from 'react';
import { rescheduleBooking } from '../api/bookings';
import { ApiError, errorMessage, isExpired } from '../api/error';
import type { Booking, Session, Slot, SlotRef } from '../api/types';
import { clubTime, formatClubDateTime } from '../lib/club-time';

type Props = {
  booking: Booking;
  slot: Slot;
  courtName: string;
  session: Session;
  /** Alerta de um 409 anterior; vive na página porque a agenda recarrega e pode remontar o painel. */
  conflictMessage?: string;
  onDone: (booking: Booking) => void;
  onConflict: (message: string) => void;
  onExpired: () => void;
};

export function ReschedulePanel({ booking, slot, courtName, session, conflictMessage = '', onDone, onConflict, onExpired }: Props) {
  const sending = useRef(false);
  const [error, setError] = useState('');
  const [submitting, startSubmit] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || sending.current) return;
    setError('');
    // Campo a campo: o corpo leva só quadra e horário.
    const input: SlotRef = { court_id: slot.court_id, starts_at: slot.starts_at };
    sending.current = true;
    startSubmit(async () => {
      try {
        onDone(await rescheduleBooking(session.token, booking.id, input));
      } catch (failure) {
        if (isExpired(failure)) return onExpired();
        if (failure instanceof ApiError && failure.status === 409) return onConflict(failure.message);
        setError(errorMessage(failure, 'Não foi possível remarcar. Tente de novo.'));
      } finally {
        sending.current = false;
      }
    });
  }

  const alert = error || conflictMessage;
  return (
    <form className="booking-panel" onSubmit={handleSubmit} noValidate aria-label={`Remarcar para ${courtName}`}>
      <h3>Remarcar reserva</h3>
      {alert && <p className="alert" role="alert">{alert}</p>}
      <dl className="reschedule-change">
        <div>
          <dt>De</dt>
          <dd>{booking.court.name} · {formatClubDateTime(booking.starts_at)}</dd>
        </div>
        <div>
          <dt>Para</dt>
          <dd>{courtName} · {formatClubDateTime(slot.starts_at)} às {clubTime(slot.ends_at)}</dd>
        </div>
      </dl>
      <p className="muted">Os convidados vão precisar confirmar presença de novo.</p>
      <div className="form-actions">
        <button type="submit" className="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? <><span className="rally" aria-hidden="true" />Remarcando…</> : 'Confirmar novo horário'}
        </button>
      </div>
    </form>
  );
}
