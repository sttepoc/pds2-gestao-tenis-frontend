import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '../api/error';

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  keepLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onKeep: () => void;
};

/** Painel de confirmação no fluxo da página: o foco começa em "manter", a ação destrutiva exige um segundo clique. */
export function ConfirmAction({ title, description, confirmLabel, keepLabel, danger, onConfirm, onKeep }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const keep = useRef<HTMLButtonElement>(null);
  const uid = useId();

  useEffect(() => { keep.current?.focus(); }, []);

  async function confirm() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (failure) {
      setError(errorMessage(failure, 'Não foi possível concluir a ação.'));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      className="confirm-action" role="alertdialog" aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-text`}
      onKeyDown={(event) => { if (event.key === 'Escape' && !busy) onKeep(); }}
    >
      <h4 id={`${uid}-title`}>{title}</h4>
      <p id={`${uid}-text`}>{description}</p>
      <div className="confirm-buttons">
        <button ref={keep} className="button button--secondary" type="button" disabled={busy} onClick={onKeep}>{keepLabel}</button>
        <button className={danger ? 'button button--danger' : 'button'} type="button" disabled={busy} onClick={confirm}>{confirmLabel}</button>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
    </div>
  );
}
