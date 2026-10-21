import type { Session } from './auth';
import { USE_MOCK_API } from './config';

// O token vive só nesta aba: fechar o navegador encerra o acesso local.
const KEY = USE_MOCK_API ? 'clube-tenis.mock-session' : 'clube-tenis.session';

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session || typeof session.token !== 'string' || !session.token ||
      typeof session.expiresAt !== 'string' || !Number.isFinite(Date.parse(session.expiresAt)) ||
      !session.user || !Number.isSafeInteger(session.user.id) ||
      typeof session.user.name !== 'string' || typeof session.user.email !== 'string' ||
      typeof session.user.created_at !== 'string' ||
      session.token.startsWith('mock-') !== USE_MOCK_API ||
      Date.parse(session.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Sem armazenamento disponível, a sessão vale até recarregar a página.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nada a limpar.
  }
}
