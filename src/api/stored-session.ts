import { ApiError, fetchCurrentUser } from './auth';
import { loadSession } from './session-storage';

// Roda uma vez por carregamento da página, antes do primeiro render:
// a conferência do token com a API já começa enquanto o React monta a tela.
export const storedSession = loadSession();

/** Resolve false só quando a API recusa o token (401). Falha de rede mantém a sessão. */
export const storedSessionCheck: Promise<boolean> | null = storedSession
  ? fetchCurrentUser(storedSession.token).then(
      () => true,
      (error: unknown) => !(error instanceof ApiError && error.status === 401),
    )
  : null;
