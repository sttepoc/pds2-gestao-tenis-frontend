import { useEffect, useTransition, type ReactNode } from 'react';
import type { Session } from './api/auth';
import { USE_MOCK_API } from './api/config';
import { AppLayout } from './components/AppLayout';
import { BallMark, CourtBackdrop } from './components/CourtBackdrop';
import { LoginForm } from './components/LoginForm';
import { MockNotice } from './components/MockNotice';
import { useMemberAccess } from './hooks/useMemberAccess';
import { useRoute } from './hooks/useRoute';
import { useSession } from './hooks/useSession';
import { navigate, type Route } from './navigation';
import { AccountPage } from './pages/AccountPage';
import { BookingDetailPage } from './pages/BookingDetailPage';
import { BookingsPage } from './pages/BookingsPage';
import { CourtsPage } from './pages/CourtsPage';
import { HomePage } from './pages/HomePage';
import { MembersPage } from './pages/MembersPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SchedulePage } from './pages/SchedulePage';
import './styles/app.css';
import './styles/booking.css';

const backdrop = <CourtBackdrop />;
const intro = (
  <section className="intro" aria-labelledby="intro-title">
    <div className="intro-copy">
      <h1 id="intro-title"><span>Entre em</span> <span>quadra.</span></h1>
      <p>Seu clube, cada vez mais organizado.</p>
    </div>
  </section>
);
const mockNotice = import.meta.env.DEV && USE_MOCK_API ? <MockNotice /> : undefined;

function ClubApp({ session, route, id, onLogout, onExpired }: {
  session: Session;
  route: Route;
  id: number | null;
  onLogout: () => Promise<void>;
  onExpired: () => void;
}) {
  const { access, retry } = useMemberAccess(session.token, onExpired);
  let page: ReactNode;
  switch (route) {
    case 'account':
      page = <AccountPage session={session} access={access} onRetry={retry} />;
      break;
    case 'members':
      page = <MembersPage access={access} onRetry={retry} />;
      break;
    case 'courts':
      page = <CourtsPage session={session} access={access} onRetry={retry} onExpired={onExpired} />;
      break;
    case 'schedule':
      page = <SchedulePage session={session} onExpired={onExpired} rescheduleId={null} />;
      break;
    case 'bookings':
      page = <BookingsPage session={session} onExpired={onExpired} />;
      break;
    case 'booking':
      page = id === null ? <NotFoundPage /> : <BookingDetailPage key={id} id={id} session={session} onExpired={onExpired} />;
      break;
    case 'not-found':
      page = <NotFoundPage />;
      break;
    default:
      page = <HomePage user={session.user} access={access} onRetry={retry} />;
  }
  return (
    <AppLayout session={session} route={route} access={access} onLogout={onLogout} mockNotice={mockNotice}>
      {page}
    </AppLayout>
  );
}

export function App() {
  const auth = useSession();
  const { route, id } = useRoute();
  const [leaving, startLeaving] = useTransition();

  useEffect(() => {
    if (auth.state.status === 'authenticated' && (route === 'login' || !window.location.hash)) {
      navigate('home', true);
    }
    const titles = {
      home: 'Início', account: 'Minha conta', members: 'Membros',
      courts: 'Quadras', schedule: 'Agenda', reschedule: 'Remarcar', bookings: 'Minhas reservas',
      booking: 'Reserva', login: 'Entrar', 'not-found': 'Página não encontrada',
    };
    const title = auth.state.status === 'authenticated' ? titles[route]
      : auth.state.status === 'anonymous' ? 'Entrar' : 'Verificar sessão';
    document.title = `${title} · Clube de Tênis`;
  }, [route, auth.state.status]);

  function handleLogin(session: Session) {
    auth.signIn(session);
    if (route === 'login' || route === 'not-found' || !window.location.hash) {
      navigate('home', true);
    }
  }

  async function handleLogout() {
    await auth.signOut();
    navigate('login', true);
  }

  let content: ReactNode;
  if (auth.state.status === 'checking') {
    content = (
      <section className="card recovery-card" aria-labelledby="session-check-title">
        <p className="eyebrow">BEM-VINDO DE VOLTA</p>
        <h2 className="card-title" id="session-check-title">Confirmando sua sessão</h2>
        <p className="status-line" role="status"><span className="rally" aria-hidden="true" />Só um instante…</p>
      </section>
    );
  } else if (auth.state.status === 'unavailable') {
    content = (
      <section className="card recovery-card" aria-labelledby="session-error-title">
        <h2 className="card-title" id="session-error-title">Vamos tentar de novo?</h2>
        <p className="card-lead">
          Não foi possível confirmar sua sessão. Seus dados de acesso foram mantidos para uma nova tentativa.
        </p>
        <p className="alert" role="alert">{auth.state.message}</p>
        <button className="submit" type="button" onClick={auth.retry} disabled={leaving}>Tentar novamente</button>
        <button
          className="button button--secondary" type="button" disabled={leaving}
          onClick={() => startLeaving(handleLogout)}
        >
          {leaving ? 'Saindo…' : 'Voltar ao login'}
        </button>
      </section>
    );
  } else if (auth.state.status === 'anonymous') {
    content = <LoginForm onLogin={handleLogin} notice={auth.state.notice} />;
  }

  return (
    <>
      {backdrop}
      {auth.state.status === 'authenticated' ? (
        <ClubApp
          key={auth.state.session.token} session={auth.state.session} route={route} id={id}
          onLogout={handleLogout} onExpired={auth.endSession}
        />
      ) : (
        <main className="page">
          <header className="entry-header">
            <div className="brand"><BallMark />Clube de Tênis</div>
            {mockNotice}
          </header>
          {intro}
          <div className="access">{content}</div>
        </main>
      )}
    </>
  );
}
