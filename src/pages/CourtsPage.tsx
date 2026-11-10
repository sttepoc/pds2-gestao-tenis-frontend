import { useEffect, useRef, useState } from 'react';
import { listCourts, removeMaintenance } from '../api/courts';
import { errorMessage, isExpired } from '../api/error';
import type { Court, MaintenanceWindow, Session } from '../api/types';
import { AccessStatus } from '../components/AccessStatus';
import { CourtCard } from '../components/CourtCard';
import { CourtForm } from '../components/CourtForm';
import { LoadError, Loading } from '../components/LoadStatus';
import { MaintenanceForm } from '../components/MaintenanceForm';
import { useLoad } from '../hooks/useLoad';
import type { MemberAccess } from '../hooks/useMemberAccess';
import { routePaths } from '../navigation';

type Props = { session: Session; access: MemberAccess; now?: () => number; onRetry: () => void; onExpired: () => void };
type Editing = 'new' | Court | null;

function CourtManager({ session, now = Date.now, onExpired }: Pick<Props, 'session' | 'now' | 'onExpired'>) {
  const { state, reload, setData } = useLoad('courts', () => listCourts(session.token), onExpired);
  const [editing, setEditing] = useState<Editing>(null);
  const [maintaining, setMaintaining] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [removing, setRemoving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<string | null>(null);

  // Ao fechar um formulário, o foco volta ao botão que o abriu (que pode ter sido remontado).
  const closed = editing === null && maintaining === null;
  useEffect(() => {
    if (closed && opener.current) {
      root.current?.querySelector<HTMLElement>(`[data-opener="${opener.current}"]`)?.focus();
      opener.current = null;
    }
  }, [closed, state.status]);

  if (state.status === 'loading') return <Loading>Carregando quadras…</Loading>;
  if (state.status === 'error') return <LoadError message={state.message} onRetry={reload} />;

  const courts = state.data;
  function open(key: string, form: { editing?: Editing; maintaining?: number }) {
    opener.current = key;
    setNotice('');
    setActionError('');
    setEditing(form.editing ?? null);
    setMaintaining(form.maintaining ?? null);
  }
  function close() {
    setEditing(null);
    setMaintaining(null);
  }
  function replaceCourt(saved: Court) {
    setData(courts.some((item) => item.id === saved.id)
      ? courts.map((item) => (item.id === saved.id ? saved : item))
      : [...courts, saved]);
  }
  function handleSaved(saved: Court) {
    replaceCourt(saved);
    setNotice('Quadra salva.');
    close();
  }
  function handleMaintenanceSaved(saved: Court) {
    replaceCourt(saved);
    setNotice('Manutenção registrada.');
    close();
  }
  async function handleRemove(court: Court, item: MaintenanceWindow) {
    if (removing) return;
    setRemoving(true);
    setNotice('');
    setActionError('');
    try {
      replaceCourt(await removeMaintenance(session.token, court.id, item.id));
      setNotice('Manutenção removida.');
    } catch (error) {
      if (isExpired(error)) return onExpired();
      setActionError(errorMessage(error, 'Não foi possível remover a manutenção. Tente de novo.'));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div ref={root}>
      {notice && <p className="notice" role="status">{notice}</p>}
      {actionError && <p className="alert" role="alert">{actionError}</p>}
      {editing === 'new' ? (
        <CourtForm key="new" token={session.token} onSaved={handleSaved} onCancel={close} onExpired={onExpired} />
      ) : (
        <button type="button" className="submit court-new" data-opener="new" onClick={() => open('new', { editing: 'new' })}>
          Nova quadra
        </button>
      )}
      {editing && editing !== 'new' && (
        <CourtForm key={editing.id} court={editing} token={session.token} onSaved={handleSaved} onCancel={close} onExpired={onExpired} />
      )}
      {courts.length === 0 ? (
        <p className="muted">Nenhuma quadra cadastrada ainda.</p>
      ) : (
        <div className="court-grid">
          {courts.map((court) => (
            <CourtCard
              key={court.id} court={court} now={now()} removing={removing}
              onRemoveMaintenance={(item) => handleRemove(court, item)}
            >
              {maintaining === court.id ? (
                <MaintenanceForm
                  court={court} token={session.token}
                  onSaved={handleMaintenanceSaved} onCancel={close} onExpired={onExpired}
                />
              ) : (
                <div className="form-actions">
                  <button
                    type="button" className="button button--secondary" data-opener={`edit-${court.id}`}
                    aria-label={`Editar ${court.name}`} onClick={() => open(`edit-${court.id}`, { editing: court })}
                  >
                    Editar
                  </button>
                  <button
                    type="button" className="button button--secondary" data-opener={`maint-${court.id}`}
                    aria-label={`Marcar manutenção em ${court.name}`}
                    onClick={() => open(`maint-${court.id}`, { maintaining: court.id })}
                  >
                    Marcar manutenção
                  </button>
                </div>
              )}
            </CourtCard>
          ))}
        </div>
      )}
    </div>
  );
}

export function CourtsPage({ session, access, now, onRetry, onExpired }: Props) {
  let content;
  if (access.status === 'allowed') {
    content = <CourtManager session={session} now={now} onExpired={onExpired} />;
  } else if (access.status === 'denied') {
    content = (
      <section className="content-panel empty-panel" aria-labelledby="courts-status-title">
        <span className="badge">Acesso restrito</span>
        <h2 id="courts-status-title">Área administrativa</h2>
        <p>O cadastro de quadras está disponível apenas para administradores do clube.</p>
        <button type="button" className="button button--secondary" onClick={onRetry}>Verificar acesso novamente</button>
      </section>
    );
  } else {
    content = (
      <section className="content-panel empty-panel" aria-labelledby="courts-status-title">
        <h2 id="courts-status-title">
          {access.status === 'error' ? 'Acesso ainda não confirmado' : 'Verificando seu acesso'}
        </h2>
        <AccessStatus access={access} onRetry={onRetry} />
      </section>
    );
  }

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Administração</p>
        <h1>Quadras</h1>
        <p>Cadastre e organize as quadras do clube.</p>
      </div>
      {content}
      <a className="text-link" href={routePaths.home}>Voltar ao início <span aria-hidden="true">→</span></a>
    </>
  );
}
