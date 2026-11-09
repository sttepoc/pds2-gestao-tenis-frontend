/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// A API ainda não libera CORS, então em desenvolvimento o Vite repassa /api para ela.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      restoreMocks: true,
      unstubGlobals: true,
      // Fuso da máquina diferente do clube: prova que as datas usam America/Sao_Paulo, não o fuso local.
      env: { TZ: 'Asia/Tokyo' },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
