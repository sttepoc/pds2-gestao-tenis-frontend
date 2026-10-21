import { useEffect, useRef, useTransition, type ReactNode } from 'react';
import type { Session } from '../api/auth';
import type { MemberAccess } from '../hooks/useMemberAccess';
import { routePaths, type Route } from '../navigation';
import { BallMark } from './CourtBackdrop';

type Props = {
  session: Session;
  route: Route;
  access: MemberAccess;
  onLogout: () => Promise<void>;
  children: ReactNode;
  mockNotice?: ReactNode;
};

export function AppLayout({ session, route, access, onLogout, children, mockNotice }: Props) {
  const mainRef = useRef<HTMLElement>(null);
  const [leaving, startLeaving] = useTransition();
  const firstName = session.user.name.trim().split(/\s+/)[0];

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [route]);

  const links = [
    { route: 'home' as const, label: 'Início' },
    { route: 'account' as const, label: 'Minha conta' },
    ...(access.status === 'allowed' ? [{ route: 'members' as const, label: 'Membros' }] : []),
  ];

  return (
    <div className="workspace">
      <a
        className="skip-link" href="#conteudo"
        onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}
      >
        Pular para o conteúdo
      </a>
      <aside className="sidebar" aria-label="Área do clube">
        <a href={routePaths.home} className="brand brand-link"><BallMark />Clube de Tênis</a>
        <p className="sidebar-caption">ÁREA DO CLUBE</p>
        <nav className="main-nav" aria-label="Navegação principal">
          {links.map((link) => (
            <a key={link.route} href={routePaths[link.route]} aria-current={route === link.route ? 'page' : undefined}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span className="avatar" aria-hidden="true">{firstName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{firstName}</strong>
              <span>{access.status === 'allowed' ? 'Administrador' : 'Conta do clube'}</span>
            </div>
          </div>
          <button
            className="logout-button" type="button" disabled={leaving} aria-busy={leaving}
            onClick={() => startLeaving(onLogout)}
          >
            {leaving ? 'Saindo…' : 'Sair da conta'}<span aria-hidden="true">↗</span>
          </button>
          {mockNotice}
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <span>CLUBE DE TÊNIS</span><span className="session-indicator">Sessão ativa</span>
        </header>
        <main className="workspace-main" id="conteudo" tabIndex={-1} ref={mainRef}>{children}</main>
        <footer className="workspace-footer">
          Clube de Tênis
        </footer>
      </div>
    </div>
  );
}
