import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { addMaintenance } from '../api/courts';
import { ApiError, errorMessage, isExpired } from '../api/error';
import type { Court, MaintenanceInput } from '../api/types';
import { fromClubLocal } from '../lib/club-time';

type Props = {
  court: Court;
  token: string;
  onSaved: (court: Court) => void;
  onCancel: () => void;
  onExpired: () => void;
};
type Field = 'starts_at' | 'ends_at' | 'reason';
type Errors = Partial<Record<Field, string>>;

const ORDER: Field[] = ['starts_at', 'ends_at', 'reason'];

export function MaintenanceForm({ court, token, onSaved, onCancel, onExpired }: Props) {
  const id = useId();
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const refs = { starts_at: startRef, ends_at: endRef, reason: reasonRef };
  const sending = useRef(false);
  const [values, setValues] = useState({ starts_at: '', ends_at: '', reason: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [cancelBookings, setCancelBookings] = useState(false);
  const [submitting, startSubmit] = useTransition();

  useEffect(() => startRef.current?.focus(), []);

  function fail(next: Errors) {
    setErrors(next);
    const first = ORDER.find((name) => next[name]);
    if (first) refs[first].current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || sending.current) return;
    setFormError('');
    const next: Errors = {};
    const reason = values.reason.trim();
    if (!values.starts_at) next.starts_at = 'Informe o início da manutenção.';
    if (!values.ends_at) next.ends_at = 'Informe o fim da manutenção.';
    else if (values.starts_at && Date.parse(fromClubLocal(values.ends_at)) <= Date.parse(fromClubLocal(values.starts_at))) {
      next.ends_at = 'O fim precisa ser depois do início.';
    }
    if (!reason) next.reason = 'Informe o motivo da manutenção.';
    if (Object.keys(next).length > 0) return fail(next);
    setErrors({});
    // Campo a campo: o corpo nunca herda chaves do estado do formulário.
    const input: MaintenanceInput = {
      starts_at: fromClubLocal(values.starts_at),
      ends_at: fromClubLocal(values.ends_at),
      reason,
    };
    if (conflict && cancelBookings) input.cancel_bookings = true;
    sending.current = true;
    startSubmit(async () => {
      try {
        onSaved(await addMaintenance(token, court.id, input));
      } catch (error) {
        if (isExpired(error)) return onExpired();
        const fields = error instanceof ApiError ? error.fieldErrors : {};
        if (error instanceof ApiError && error.status === 409 && fields.cancel_bookings) {
          setConflict(true);
          setFormError(error.message);
          return;
        }
        const server: Errors = {};
        for (const name of ORDER) {
          const message = fields[name]?.[0];
          if (message) server[name] = message;
        }
        if (Object.keys(server).length > 0) fail(server);
        else setFormError(errorMessage(error, 'Não foi possível registrar a manutenção. Tente de novo.'));
      } finally {
        sending.current = false;
      }
    });
  }

  function field(name: Field, label: string, type: 'datetime-local' | 'text') {
    const errorId = `${id}-${name}-error`;
    return (
      <div className="field">
        <label htmlFor={`${id}-${name}`}>{label}</label>
        <input
          ref={refs[name]} id={`${id}-${name}`} name={name} type={type}
          maxLength={type === 'text' ? 200 : undefined} autoComplete="off"
          value={values[name]}
          onChange={(event) => {
            setValues({ ...values, [name]: event.target.value });
            // A confirmação vale só para o período avisado: mudar o período a invalida.
            if (name !== 'reason' && conflict) {
              setConflict(false);
              setCancelBookings(false);
              setFormError('');
            }
          }}
          aria-invalid={errors[name] ? true : undefined} aria-describedby={errors[name] ? errorId : undefined}
        />
        {errors[name] && <p id={errorId} className="field-error">{errors[name]}</p>}
      </div>
    );
  }

  return (
    <form className="maintenance-form" onSubmit={handleSubmit} noValidate aria-label={`Manutenção de ${court.name}`}>
      {formError && <p className="alert" role="alert">{formError}</p>}
      {field('starts_at', 'Início', 'datetime-local')}
      {field('ends_at', 'Fim', 'datetime-local')}
      {field('reason', 'Motivo', 'text')}
      {conflict && (
        <div className="field field--check">
          <input
            id={`${id}-cancel`} type="checkbox" checked={cancelBookings}
            onChange={(event) => setCancelBookings(event.target.checked)}
          />
          <label htmlFor={`${id}-cancel`}>Cancelar as reservas afetadas</label>
        </div>
      )}
      <div className="form-actions">
        <button type="submit" className="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? <><span className="rally" aria-hidden="true" />Salvando…</> : 'Salvar manutenção'}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel} disabled={submitting}>Cancelar</button>
      </div>
    </form>
  );
}
