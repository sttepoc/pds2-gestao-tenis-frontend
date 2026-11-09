import { useState } from 'react';
import { listCourts } from '../api/courts';
import type { Court, Session } from '../api/types';
import { AccessStatus } from '../components/AccessStatus';
import { CourtCard } from '../components/CourtCard';
import { CourtForm } from '../components/CourtForm';
import { useLoad } from '../hooks/useLoad';
import type { MemberAccess } from '../hooks/useMemberAccess';
import { routePaths } from '../navigation';

type Props = { session: Session; access: MemberAccess; onRetry: () => void; onExpired: () => void };
type Editing = 'new' | Court | null;

function CourtManager({ session, onExpired }: Pick<Props, 'session' | 'onExpired'>) {
  const { state, reload, setData } = useLoad('courts', () => listCourts(session.token), onExpired);
  const [editing, setEditing] = useState<Editing>(null);

  if (state.status === 'loading') {
    return <p className="status-line" role="status"><span className="rally" aria-hidden="true" />Carregando quadras…</p>;
  }
  if (state.status === 'error') {
    return (
      <div className="access-feedback">
        <p className="alert" role="alert">{state.message}</p>
        <button className="button button--secondary" type="button" onClick={reload}>Tentar novamente</button>
      </div>
    );
  }

  const courts = state.data;
  function handleSaved(saved: Court) {
    setData(courts.some((item) => item.id === saved.id)
      ? courts.map((item) => (item.id === saved.id ? saved : item))
      : [...courts, saved]);
    setEditing(null);
  }

  return (
    <>
      {editing ? (
        <CourtForm
          key={editing === 'new' ? 'new' : editing.id}
          court={editing === 'new' ? undefined : editing}
          token={session.token}
          onSaved={handleSaved} onCancel={() => setEditing(null)} onExpired={onExpired}
        />
      ) : (
        <button type="button" className="submit court-new" onClick={() => setEditing('new')}>Nova quadra</button>
      )}
      {courts.length === 0 ? (
        <p className="muted">Nenhuma quadra cadastrada ainda.</p>
      ) : (
        <div className="quick-access-grid">
          {courts.map((court) => (
            <CourtCard key={court.id} court={court}>
              <button type="button" className="button button--secondary" onClick={() => setEditing(court)}>Editar</button>
            </CourtCard>
          ))}
        </div>
      )}
    </>
  );
}

export function CourtsPage({ session, access, onRetry, onExpired }: Props) {
  let content;
  if (access.status === 'allowed') {
    content = <CourtManager session={session} onExpired={onExpired} />;
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
        <p className="eyebrow">ADMINISTRAÇÃO</p>
        <h1>Quadras</h1>
        <p>Cadastre e organize as quadras do clube.</p>
      </div>
      {content}
      <a className="text-link" href={routePaths.home}>Voltar ao início <span aria-hidden="true">→</span></a>
    </>
  );
}
