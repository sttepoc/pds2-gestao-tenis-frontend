import type { ApiServices, Session } from '../api/types';
import { mockApiFor } from '../mocks/api';
import { createMockContext, type MockContext } from '../mocks/context';
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD, DEMO_USER_EMAIL } from '../mocks/fixtures';

let current: ApiServices | null = null;

/** Instância devolvida por getApi() nos testes (ver o vi.mock em setup.ts). */
export function testApi(): ApiServices {
  if (!current) throw new Error('Chame setupTestApi() antes de usar a API nos testes.');
  return current;
}

type TestApi = { api: ApiServices; ctx: MockContext; admin: Session; player: Session; mariana: Session; pedro: Session };

// player = Bruno (usuario@), admin = Ana. O cenário só vale depois dos logins,
// para que 'error' ou 'expired' não impeçam a preparação.
export async function setupTestApi({ now, scenario = 'success' }: { now?: () => number; scenario?: string } = {}): Promise<TestApi> {
  const ctx = createMockContext({ delayMs: 0, now });
  const api = mockApiFor(ctx);
  const [admin, player, mariana, pedro] = await Promise.all(
    [DEMO_ADMIN_EMAIL, DEMO_USER_EMAIL, 'mariana@clube.example', 'pedro@clube.example'].map((email) => api.login(email, DEMO_PASSWORD)),
  );
  ctx.scenario = scenario;
  current = api;
  return { api, ctx, admin, player, mariana, pedro };
}
