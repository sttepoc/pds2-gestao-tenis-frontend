import { MOCK_DELAY_MS, MOCK_SCENARIO, USE_MOCK_API } from './config';
import { realApi } from './real';
import type { ApiServices } from './types';

const api: Promise<ApiServices> = import.meta.env.DEV && USE_MOCK_API
  ? import('../mocks/api').then(({ createMockApi }) => {
      let storage: Storage | undefined;
      try { storage = window.sessionStorage; } catch { /* Usa memória se indisponível. */ }
      return createMockApi({ delayMs: MOCK_DELAY_MS, scenario: MOCK_SCENARIO, storage });
    })
  : Promise.resolve(realApi);

export const getApi = () => api;
