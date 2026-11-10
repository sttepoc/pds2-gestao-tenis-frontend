import { useEffect } from 'react';
import type { Session, WaitlistEntry } from '../api/types';
import { listWaitlist } from '../api/waitlist';
import { useLoad } from './useLoad';

/** Entradas da fila com oferta vigente. Recarrega ao montar e quando a aba volta a ficar visível. */
export function useWaitlistOffers(session: Session, onExpired: () => void): { offers: WaitlistEntry[]; reload(): void } {
  const { state, reload } = useLoad(`offers:${session.token}`, () => listWaitlist(session.token), onExpired);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  // Durante a recarga mostra a última lista da mesma sessão: a faixa não pisca nem perde o foco.
  // Falha ao carregar só deixa a faixa de fora: a fila tem tela própria com o erro.
  const entries = state.status === 'ready' ? state.data : state.status === 'loading' ? state.previous ?? [] : [];
  return { offers: entries.filter((entry) => entry.offer !== null), reload };
}
