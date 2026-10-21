/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL da API em produção. Vazio em desenvolvimento, onde o proxy do Vite atende /api. */
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCK_API?: string;
  readonly VITE_MOCK_DELAY_MS?: string;
  readonly VITE_MOCK_SCENARIO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
