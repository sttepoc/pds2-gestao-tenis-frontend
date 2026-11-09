import { useRef, useState } from 'react';
import { ApiError, errorMessage, isExpired } from '../api/error';
import type { Booking, Session, WaitlistEntry } from '../api/types';
import { acceptOffer, declineOffer } from '../api/waitlist';
import { useWaitlistOffers } from '../hooks/useWaitlistOffers';
import { clubTime, formatClubDateTime } from '../lib/club-time';

/** O que aconteceu com a oferta: a faixa sai da tela em todos os casos. */
export type OfferResult =
  | { kind: 'accepted'; booking: Booking }
  | { kind: 'declined' }
  | { kind: 'gone'; message: string };

type Props = {
  entry: WaitlistEntry;
  session: Session;
  onDone: (result: OfferResult) => void;
  onExpired: () => void;
};

export function OfferBanner({ entry, session, onDone, onExpired }: Props) {
  const sending = useRef(false);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');

  async function respond(action: 'accept' | 'decline') {
    if (sending.current) return;
    sending.current = true;
    setBusy(action);
    setError('');
    try {
      if (action === 'accept') onDone({ kind: 'accepted', booking: await acceptOffer(session.token, entry.id) });
      else {
        await declineOffer(session.token, entry.id);
        onDone({ kind: 'declined' });
      }
    } catch (failure) {
      if (isExpired(failure)) return onExpired();
      // 409 (venceu) ou 404 (já saiu da fila): a oferta acabou, a lista recarrega.
      if (failure instanceof ApiError && failure.status === 409) return onDone({ kind: 'gone', message: failure.message });
      if (failure instanceof ApiError && failure.status === 404) {
        return onDone(action === 'decline' ? { kind: 'declined' } : { kind: 'gone', message: 'Essa oferta não está mais disponível.' });
      }
      setError(errorMessage(failure, 'Não foi possível responder à oferta. Tente de novo.'));
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  return (
    <section className="offer-banner" role="region" aria-label="Vaga liberada">
      <div>
        <h2>Vaga liberada para você</h2>
        <p>
          {entry.court.name} · {formatClubDateTime(entry.starts_at)}. Responda até {clubTime(entry.offer!.expires_at)}.
        </p>
      </div>
      <div className="offer-actions">
        <button className="button button--secondary" type="button" disabled={busy !== null} onClick={() => respond('decline')}>
          {busy === 'decline' ? <><span className="rally" aria-hidden="true" />Recusando…</> : 'Recusar'}
        </button>
        <button className="button" type="button" disabled={busy !== null} onClick={() => respond('accept')}>
          {busy === 'accept' ? <><span className="rally" aria-hidden="true" />Confirmando…</> : 'Aceitar vaga'}
        </button>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
    </section>
  );
}

const notices: Record<'accepted' | 'declined', string> = {
  accepted: 'Vaga confirmada. A reserva já está em Minhas reservas.',
  declined: 'Vaga recusada. Ela segue para o próximo da fila.',
};

/** Faixas das ofertas vigentes do jogador, com o aviso da última resposta. */
export function OfferBanners({ session, onExpired, onChange }: {
  session: Session;
  onExpired: () => void;
  /** Chamado depois de aceitar ou recusar, para a página recarregar o que depende da fila. */
  onChange?: () => void;
}) {
  const { offers, reload } = useWaitlistOffers(session, onExpired);
  const [message, setMessage] = useState<{ kind: 'notice' | 'alert'; text: string } | null>(null);
  // A faixa respondida some na hora, sem esperar a lista recarregar.
  const [answered, setAnswered] = useState<number[]>([]);
  const visible = offers.filter((entry) => !answered.includes(entry.id));

  function done(id: number, result: OfferResult) {
    setAnswered((ids) => [...ids, id]);
    setMessage(result.kind === 'gone' ? { kind: 'alert', text: result.message } : { kind: 'notice', text: notices[result.kind] });
    reload();
    onChange?.();
  }

  if (visible.length === 0 && !message) return null;
  return (
    <div className="offer-banners">
      {message?.kind === 'notice' && <p className="notice" role="status">{message.text}</p>}
      {message?.kind === 'alert' && <p className="alert" role="alert">{message.text}</p>}
      {visible.map((entry) => (
        <OfferBanner key={entry.id} entry={entry} session={session} onDone={(result) => done(entry.id, result)} onExpired={onExpired} />
      ))}
    </div>
  );
}
