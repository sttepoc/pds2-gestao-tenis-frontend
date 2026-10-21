import { AccessStatus } from '../components/AccessStatus';
import type { MemberAccess } from '../hooks/useMemberAccess';
import { routePaths } from '../navigation';

export function MembersPage({ access, onRetry }: { access: MemberAccess; onRetry: () => void }) {
  let statusContent;
  if (access.status === 'allowed') {
    statusContent = (
      <>
        <span className="badge badge--active">Acesso autorizado</span>
        <h2 id="members-status-title">Área de membros</h2>
        <p>As ferramentas de consulta, cadastro e edição de membros serão disponibilizadas aqui.</p>
        <p className="muted">O cadastro de um membro do clube é independente de uma conta de acesso.</p>
      </>
    );
  } else if (access.status === 'denied') {
    statusContent = (
      <>
        <span className="badge">Acesso restrito</span>
        <h2 id="members-status-title">Área administrativa</h2>
        <p>Esta área está disponível apenas para administradores do clube.</p>
        <button type="button" className="button button--secondary" onClick={onRetry}>
          Verificar acesso novamente
        </button>
      </>
    );
  } else {
    statusContent = (
      <>
        <h2 id="members-status-title">
          {access.status === 'error' ? 'Acesso ainda não confirmado' : 'Verificando seu acesso'}
        </h2>
        <AccessStatus access={access} onRetry={onRetry} />
      </>
    );
  }

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">ADMINISTRAÇÃO</p>
        <h1>Membros</h1>
        <p>O espaço de gestão dos membros do clube.</p>
      </div>
      <section className="content-panel empty-panel" aria-labelledby="members-status-title">
        {statusContent}
        <a className="text-link" href={routePaths.home}>
          Voltar ao início <span aria-hidden="true">→</span>
        </a>
      </section>
    </>
  );
}
