/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL da API em produção. Vazio em desenvolvimento, onde o proxy do Vite atende /api. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
