import type { User } from '../api/auth';
import { AccessStatus } from '../components/AccessStatus';
import type { MemberAccess } from '../hooks/useMemberAccess';
import { routePaths } from '../navigation';

export function HomePage({ user, access, onRetry }: { user: User; access: MemberAccess; onRetry: () => void }) {
  const firstName = user.name.trim().split(/\s+/)[0];
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">SEU ESPAÇO NO CLUBE</p>
        <h1>Olá, {firstName}.</h1>
        <p>Bom ter você por aqui. O que vamos organizar hoje?</p>
      </div>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div>
          <p className="eyebrow">DENTRO E FORA DE QUADRA</p>
          <h2 id="welcome-title">Tudo começa com<br />um clube organizado.</h2>
          <p>Acesse seus dados e encontre as áreas disponíveis para sua conta.</p>
        </div>
        <div className="mini-court" aria-hidden="true"><span /><i /></div>
      </section>
      <section aria-labelledby="quick-access-title">
        <div className="section-heading">
          <h2 id="quick-access-title">Acesso rápido</h2>
          <span>Seu dia a dia no clube</span>
        </div>
        <div className="quick-access-grid">
          <a className="destination-card" href={routePaths.account}>
            <span className="destination-tag">ÁREA PESSOAL</span>
            <h3>Minha conta <span aria-hidden="true">↗</span></h3>
            <p>Consulte seus dados e as informações da sua sessão.</p>
            <span className="destination-action">Ver minha conta <span aria-hidden="true">→</span></span>
          </a>
          {access.status === 'allowed' && (
            <a className="destination-card" href={routePaths.members}>
              <span className="destination-tag">ADMINISTRAÇÃO</span>
              <h3>Membros <span aria-hidden="true">↗</span></h3>
              <p>Acesse a área administrativa de membros do clube.</p>
              <span className="destination-action">Acessar área <span aria-hidden="true">→</span></span>
            </a>
          )}
        </div>
      </section>
      <section className="permission-note" aria-label="Permissões da conta">
        <AccessStatus access={access} onRetry={onRetry} />
      </section>
    </>
  );
}
