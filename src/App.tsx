import { useEffect, useState } from 'react';
import { logout, type Session } from './api/auth';
import { clearSession, loadSession, saveSession } from './api/session-storage';
import { storedSession, storedSessionCheck } from './api/stored-session';
import { BallMark, CourtBackdrop } from './components/CourtBackdrop';
import { LoginForm } from './components/LoginForm';
import { SignedIn } from './components/SignedIn';

// Partes estáticas criadas uma vez: não são recriadas quando a sessão muda.
const backdrop = <CourtBackdrop />;
const intro = (
  <section className="intro" aria-labelledby="intro-title">
    <div className="brand">
      <BallMark />
      Clube de Tênis
    </div>
    <div className="intro-copy">
      <h1 id="intro-title">Entre em quadra.</h1>
      <p>Reserve horários, confirme presença nas partidas e encontre parceiros do seu nível.</p>
    </div>
  </section>
);

export function App() {
  const [session, setSession] = useState<Session | null>(storedSession);
  const [notice, setNotice] = useState('');

  // Só aplica o resultado da conferência iniciada no carregamento.
  useEffect(() => {
    if (!storedSession || !storedSessionCheck) return;
    const { token } = storedSession;
    let active = true;
    storedSessionCheck.then((valid) => {
      // Ignora se a pessoa já saiu ou entrou com outra conta nesse meio-tempo.
      if (valid || !active || loadSession()?.token !== token) return;
      clearSession();
      setSession(null);
      setNotice('Sua sessão expirou. Entre de novo para continuar.');
    });
    return () => {
      active = false;
    };
  }, []);

  function handleLogin(next: Session) {
    saveSession(next);
    setNotice('');
    setSession(next);
  }

  async function handleLogout() {
    if (session) await logout(session.token).catch(() => undefined);
    clearSession();
    setSession(null);
    setNotice('Você saiu da sua conta.');
  }

  return (
    <>
      {backdrop}
      <main className="page">
        {intro}
        <div className="access">
          {session ? (
            <SignedIn session={session} onLogout={handleLogout} />
          ) : (
            <LoginForm onLogin={handleLogin} notice={notice} />
          )}
        </div>
      </main>
    </>
  );
}
