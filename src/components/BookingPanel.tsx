import { useRef, useState, useTransition, type FormEvent } from 'react';
import { createBooking } from '../api/bookings';
import { ApiError, errorMessage, isExpired } from '../api/error';
import type { Booking, BookingInput, Player, Session, Slot, WaitlistEntry } from '../api/types';
import { joinWaitlist } from '../api/waitlist';
import { PlayerPicker } from './PlayerPicker';

type Props = {
  slot: Slot;
  courtName: string;
  session: Session;
  /** Alerta de um 409 anterior; vive na página porque a agenda recarrega e pode remontar o painel. */
  conflictMessage?: string;
  /** Só quando o horário recarregou como ocupado por outra pessoa (não manutenção). */
  canQueue?: boolean;
  onBooked: (booking: Booking) => void;
  onQueued?: (entry: WaitlistEntry) => void;
  onConflict: (message: string) => void;
  onExpired: () => void;
};

export function BookingPanel({ slot, courtName, session, conflictMessage = '', canQueue = false, onBooked, onQueued, onConflict, onExpired }: Props) {
  const sending = useRef(false);
  const [guests, setGuests] = useState<Player[]>([]);
  const [error, setError] = useState('');
  const [submitting, startSubmit] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || sending.current) return;
    setError('');
    // Campo a campo: o corpo nunca herda chaves do estado do formulário.
    const input: BookingInput = {
      court_id: slot.court_id,
      starts_at: slot.starts_at,
      participant_ids: guests.map((player) => player.id),
    };
    sending.current = true;
    startSubmit(async () => {
      try {
        onBooked(await createBooking(session.token, input));
      } catch (failure) {
        if (isExpired(failure)) return onExpired();
        if (failure instanceof ApiError && failure.status === 409) return onConflict(failure.message);
        setError(errorMessage(failure, 'Não foi possível reservar. Tente de novo.'));
      } finally {
        sending.current = false;
      }
    });
  }

  function handleQueue() {
    if (submitting || sending.current) return;
    setError('');
    sending.current = true;
    startSubmit(async () => {
      try {
        const entry = await joinWaitlist(session.token, { court_id: slot.court_id, starts_at: slot.starts_at });
        onQueued?.(entry);
      } catch (failure) {
        if (isExpired(failure)) return onExpired();
        setError(errorMessage(failure, 'Não foi possível entrar na fila. Tente de novo.'));
      } finally {
        sending.current = false;
      }
    });
  }

  const alert = error || conflictMessage;
  return (
    <form className="booking-panel" onSubmit={handleSubmit} noValidate aria-label={`Reservar ${courtName}`}>
      <h3>Confirmar reserva</h3>
      {alert && <p className="alert" role="alert">{alert}</p>}
      {canQueue && conflictMessage && (
        <button type="button" className="button button--secondary" disabled={submitting} onClick={handleQueue}>
          Entrar na fila de espera
        </button>
      )}
      <PlayerPicker value={guests} onChange={setGuests} max={3} session={session} onExpired={onExpired} />
      <div className="form-actions">
        <button type="submit" className="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? <><span className="rally" aria-hidden="true" />Reservando…</> : 'Reservar quadra'}
        </button>
      </div>
    </form>
  );
}
