import { useRef, useState } from 'react';
import { cancelBooking } from '../api/bookings';
import { isExpired } from '../api/error';
import type { Booking, Session } from '../api/types';
import { clubDateLabel, clubTime } from '../lib/club-time';
import { ConfirmAction } from './ConfirmAction';

type Props = {
  booking: Booking;
  session: Session;
  onCancelled: (booking: Booking) => void;
  onExpired: () => void;
  now?: () => number;
};

export function CancelBookingAction({ booking, session, onCancelled, onExpired, now = Date.now }: Props) {
  const [asking, setAsking] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  // Em andamento ainda vem como ativa; o servidor também confere (422).
  if (booking.my_role !== 'organizer' || booking.status !== 'active' || Date.parse(booking.starts_at) <= now()) return null;

  async function confirm() {
    try {
      onCancelled(await cancelBooking(session.token, booking.id));
    } catch (failure) {
      if (isExpired(failure)) return onExpired();
      throw failure;
    }
  }

  function keep() {
    setAsking(false);
    opener.current?.focus();
  }

  return (
    <div className="cancel-booking">
      <button
        ref={opener} className="button button--secondary" type="button"
        aria-label={`Cancelar reserva da ${booking.court.name} em ${clubDateLabel(booking.starts_at)} ${clubTime(booking.starts_at)}`}
        onClick={() => setAsking(true)}
      >
        Cancelar
      </button>
      {asking && (
        <ConfirmAction
          title="Cancelar reserva?"
          description="Os participantes serão avisados e a vaga vai para a fila de espera."
          confirmLabel="Cancelar reserva" keepLabel="Manter reserva" danger
          onConfirm={confirm} onKeep={keep}
        />
      )}
    </div>
  );
}
