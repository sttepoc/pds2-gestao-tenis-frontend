import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchCurrentUser, logout, type Session } from '../api/auth';
import { clearSession, loadSession, saveSession } from '../api/session-storage';

type AuthState =
  | { status: 'anonymous'; session: null; notice: string }
  | { status: 'checking'; session: Session }
  | { status: 'unavailable'; session: Session; message: string }
  | { status: 'authenticated'; session: Session };

function initialState(): AuthState {
  const session = loadSession();
  return session ? { status: 'checking', session } : { status: 'anonymous', session: null, notice: '' };
}

export function useSession() {
  const [state, setState] = useState<AuthState>(initialState);
  // Invalida um logout em andamento se a sessão já tiver mudado ou expirado.
  const version = useRef(0);

  const endSession = useCallback((notice = 'Sua sessão expirou. Entre de novo para continuar.') => {
    version.current++;
    clearSession();
    setState({ status: 'anonymous', session: null, notice });
  }, []);

  useEffect(() => {
    if (state.status !== 'checking') return;
    let active = true;
    const session = state.session;
    fetchCurrentUser(session.token).then((user) => {
      if (!active) return;
      if (Date.parse(session.expiresAt) <= Date.now()) return endSession();
      const updated = { ...session, user };
      saveSession(updated);
      setState({ status: 'authenticated', session: updated });
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) return endSession();
      setState({
        status: 'unavailable', session,
        message: error instanceof ApiError ? error.message : 'Não foi possível confirmar sua sessão. Tente novamente.',
      });
    });
    return () => { active = false; };
  }, [state, endSession]);

  const expiresAt = state.session?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timeout = window.setTimeout(() => endSession(), Math.max(0, Date.parse(expiresAt) - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [expiresAt, endSession]);

  function signIn(session: Session) {
    version.current++;
    saveSession(session);
    setState({ status: 'authenticated', session });
  }

  async function signOut() {
    const currentVersion = version.current;
    if (state.session) await logout(state.session.token).catch(() => undefined);
    if (currentVersion === version.current) endSession('Você saiu da sua conta.');
  }

  function retry() {
    if (state.status === 'unavailable') setState({ status: 'checking', session: state.session });
  }

  return { state, signIn, signOut, retry, endSession };
}
