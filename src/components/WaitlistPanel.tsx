import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ApiError, errorMessage, isExpired } from '../api/error';
import type { Session, Slot } from '../api/types';
import { joinWaitlist, leaveWaitlist, listWaitlist } from '../api/waitlist';

type Entry = { id: number; position: number | null };

type Props = {
  slot: Slot;
  courtName: string;
  session: Session;
  /** Entrada que acabou de ser criada em outro painel; evita mostrar o estado antigo até a agenda recarregar. */
  initial?: { id: number; position: number } | null;
  onChange: () => void;
  onExpired: () => void;
};

export function WaitlistPanel({ slot, courtName, session, initial = null, onChange, onExpired }: Props) {
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [entry, setEntry] = useState<Entry | null>(() =>
    initial ?? (slot.waitlist_entry_id === null ? null : { id: slot.waitlist_entry_id, position: null }));

  // Acompanha a agenda recarregada: ela é o estado real depois de 404 (saiu em outra aba) ou 409 (já entrou).
  // Ajustado durante o render (sem efeito): a tela nunca mostra um quadro com o estado antigo.
  const [seenEntryId, setSeenEntryId] = useState(slot.waitlist_entry_id);
  if (seenEntryId !== slot.waitlist_entry_id) {
    const id = slot.waitlist_entry_id;
    setSeenEntryId(id);
    setEntry((current) => (id === null ? null : current?.id === id ? current : { id, position: null }));
  }

  // A agenda só informa o id da entrada; a posição vem da lista do jogador.
  const needsPosition = entry !== null && entry.position === null;
  const entryId = entry?.id;
  const expire = useEffectEvent(onExpired);
  useEffect(() => {
    if (!needsPosition) return;
    let active = true;
    listWaitlist(session.token).then((items) => {
      const found = items.find((item) => item.id === entryId);
      if (!active) return;
      if (found) setEntry({ id: found.id, position: found.position });
      else setError('Não foi possível confirmar sua posição na fila.');
    }).catch((failure: unknown) => {
      if (!active) return;
      if (isExpired(failure)) return expire();
      setError(errorMessage(failure, 'Não foi possível confirmar sua posição na fila.'));
    });
    return () => { active = false; };
  }, [needsPosition, entryId, session.token]);

  async function toggle() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      if (entry) {
        await leaveWaitlist(session.token, entry.id);
        setEntry(null);
      } else {
        // Campo a campo: o corpo nunca herda chaves do estado.
        const joined = await joinWaitlist(session.token, { court_id: slot.court_id, starts_at: slot.starts_at });
        setEntry({ id: joined.id, position: joined.position });
      }
      onChange();
    } catch (failure) {
      if (isExpired(failure)) return onExpired();
      // Entrada que já não existe (404) ou já existente (409): a agenda recarrega e mostra o estado real.
      if (failure instanceof ApiError && failure.status === 404 && entry) setEntry(null);
      if (failure instanceof ApiError && (failure.status === 404 || failure.status === 409)) onChange();
      setError(errorMessage(failure, 'Não foi possível atualizar a fila. Tente de novo.'));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="waitlist-panel" aria-label={`Fila de espera da ${courtName}`}>
      <h3>Fila de espera</h3>
      {error && <p className="alert" role="alert">{error}</p>}
      <p>
        {!entry && `Você seria o ${slot.waitlist_size - (slot.waitlist_entry_id === null ? 0 : 1) + 1}º da fila`}
        {entry && entry.position !== null && `Você é o ${entry.position}º da fila`}
        {entry && entry.position === null && 'Você está na fila'}
      </p>
      <div className="form-actions">
        <button
          type="button" className={entry ? 'button button--secondary' : 'submit'} disabled={busy} aria-busy={busy}
          onClick={toggle}
        >
          {busy ? <><span className="rally" aria-hidden="true" />Aguarde…</> : entry ? 'Sair da fila' : 'Entrar na fila'}
        </button>
      </div>
    </section>
  );
}
