import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { createCourt, updateCourt } from '../api/courts';
import { ApiError, errorMessage, isExpired } from '../api/error';
import type { Court, CourtInput, Surface } from '../api/types';
import { SURFACE_LABELS } from './CourtCard';

type Props = {
  court?: Court;
  token: string;
  onSaved: (court: Court) => void;
  onCancel: () => void;
  onExpired: () => void;
};

export function CourtForm({ court, token, onSaved, onCancel, onExpired }: Props) {
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const [name, setName] = useState(court?.name ?? '');
  const [surface, setSurface] = useState<Surface>(court?.surface ?? 'clay');
  const [covered, setCovered] = useState(court?.covered ?? false);
  const [nameError, setNameError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, startSubmit] = useTransition();

  useEffect(() => nameRef.current?.focus(), []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || sending.current) return;
    setFormError('');
    if (!name.trim()) {
      setNameError('Informe o nome da quadra.');
      return nameRef.current?.focus();
    }
    setNameError('');
    // Campo a campo: o corpo nunca herda chaves do estado do formulário.
    const input: CourtInput = { name: name.trim(), surface, covered };
    sending.current = true;
    startSubmit(async () => {
      try {
        onSaved(court ? await updateCourt(token, court.id, input) : await createCourt(token, input));
      } catch (error) {
        if (isExpired(error)) return onExpired();
        const serverName = error instanceof ApiError ? error.fieldErrors.name?.[0] : undefined;
        if (serverName) {
          setNameError(serverName);
          nameRef.current?.focus();
        } else {
          setFormError(errorMessage(error, 'Não foi possível salvar a quadra. Tente de novo.'));
        }
      } finally {
        sending.current = false;
      }
    });
  }

  const errorId = `${id}-name-error`;

  return (
    <form className="content-panel court-form" onSubmit={handleSubmit} noValidate aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{court ? 'Editar quadra' : 'Nova quadra'}</h2>
      {formError && <p className="alert" role="alert">{formError}</p>}

      <div className="field">
        <label htmlFor={`${id}-name`}>Nome</label>
        <input
          ref={nameRef} id={`${id}-name`} name="name" type="text" maxLength={60} autoComplete="off"
          value={name} onChange={(event) => setName(event.target.value)}
          aria-invalid={nameError ? true : undefined} aria-describedby={nameError ? errorId : undefined}
        />
        {nameError && <p id={errorId} className="field-error">{nameError}</p>}
      </div>

      <div className="field">
        <label htmlFor={`${id}-surface`}>Piso</label>
        <select id={`${id}-surface`} name="surface" value={surface} onChange={(event) => setSurface(event.target.value as Surface)}>
          {(Object.keys(SURFACE_LABELS) as Surface[]).map((value) => (
            <option key={value} value={value}>{SURFACE_LABELS[value]}</option>
          ))}
        </select>
      </div>

      <div className="field field--check">
        <input id={`${id}-covered`} name="covered" type="checkbox" checked={covered} onChange={(event) => setCovered(event.target.checked)} />
        <label htmlFor={`${id}-covered`}>Coberta</label>
      </div>

      <div className="form-actions">
        <button type="submit" className="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? <><span className="rally" aria-hidden="true" />Salvando…</> : 'Salvar quadra'}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel} disabled={submitting}>Cancelar</button>
      </div>
    </form>
  );
}
