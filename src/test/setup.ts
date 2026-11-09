import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Caminho relativo a este arquivo: aponta para src/api/client.ts.
vi.mock('../api/client', async () => {
  const { testApi } = await import('./api');
  return { getApi: async () => testApi() };
});

afterEach(() => cleanup());
