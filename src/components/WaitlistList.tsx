import { useRef, useState } from 'react';
import { ApiError, errorMessage, isExpired } from '../api/error';
import type { Session, WaitlistEntry } from '../api/types';
import { leaveWaitlist } from '../api/waitlist';
import { clubDate, clubDateLabel, clubTime, dayParts } from '../lib/club-time';

type Props = {
  entries: WaitlistEntry[];
  session: Session;
  onChange: (left: WaitlistEntry) => void;
  onExpired: () => void;
};

export function WaitlistList({ entries, session, onChange, onExpired }: Props) {
  const sending = useRef(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function leave(entry: WaitlistEntry) {
    if (sending.current) return;
    sending.current = true;
    setBusyId(entry.id);
    setError('');
    try {
      await leaveWaitlist(session.token, entry.id);
      onChange(entry);
    } catch (failure) {
      if (isExpired(failure)) return onExpired();
      // Já saiu da fila (em outra aba, ou a oferta venceu): a entrada some daqui também.
      if (failure instanceof ApiError && failure.status === 404) onChange(entry);
      setError(errorMessage(failure, 'Não foi possível sair da fila. Tente de novo.'));
    } finally {
      sending.current = false;
      setBusyId(null);
    }
  }

  return (
    <>
      {error && <p className="alert" role="alert">{error}</p>}
      {entries.length === 0 ? (
        <div className="empty-state"><p className="muted">Você não está em nenhuma fila.</p></div>
      ) : (
        <div className="booking-list">
          {entries.map((entry) => {
            const { weekday, day } = dayParts(clubDate(entry.starts_at));
            return (
              <article className="booking-card" key={entry.id}>
                <div className="booking-date" aria-hidden="true">
                  <span>{weekday}</span>
                  <strong>{day}</strong>
                </div>
                <div className="booking-info">
                  <h3>{entry.court.name}</h3>
                  <p className="booking-meta">
                    <time dateTime={entry.starts_at}>{clubDateLabel(entry.starts_at)}</time>
                    <span>{clubTime(entry.starts_at)}–{clubTime(entry.ends_at)}</span>
                    <span className="booking-badge">{entry.position}º na fila</span>
                  </p>
                  <div className="booking-actions">
                    <button
                      type="button" className="button button--secondary" disabled={busyId !== null}
                      aria-label={`Sair da fila: ${entry.court.name}, ${clubDateLabel(entry.starts_at)} ${clubTime(entry.starts_at)}`}
                      onClick={() => leave(entry)}
                    >
                      Sair da fila
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
