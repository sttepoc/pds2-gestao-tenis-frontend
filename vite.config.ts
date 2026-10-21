import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// A API ainda não libera CORS, então em desenvolvimento o Vite repassa /api para ela.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
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
