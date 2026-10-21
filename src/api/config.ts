// O build de produção sempre usa HTTP, mesmo se a variável estiver ativada.
export const USE_MOCK_API = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === 'true';
const delay = Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 450);
export const MOCK_DELAY_MS = Number.isFinite(delay) ? Math.min(10000, Math.max(0, delay)) : 450;
export const MOCK_SCENARIO = import.meta.env.VITE_MOCK_SCENARIO ?? 'success';
