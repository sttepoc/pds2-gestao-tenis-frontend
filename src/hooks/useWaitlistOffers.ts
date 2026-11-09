import { useEffect, useRef } from 'react';
import type { Session, WaitlistEntry } from '../api/types';
import { listWaitlist } from '../api/waitlist';
import { useLoad, type Load } from './useLoad';

/** Entradas da fila com oferta vigente. Recarrega ao montar e quando a aba volta a ficar visível. */
export function useWaitlistOffers(session: Session, onExpired: () => void): { offers: WaitlistEntry[]; reload(): void } {
  const key = `offers:${session.token}`;
  const { state, reload } = useLoad(key, () => listWaitlist(session.token), onExpired);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  // Durante a recarga mostra a última lista da mesma sessão: a faixa não pisca nem perde o foco.
  // Só guarda um estado novo: logo depois de trocar a sessão, o estado pronto ainda é o da anterior.
  const lastReady = useRef<{ key: string; state: Load<WaitlistEntry[]> } | null>(null);
  if (state.status === 'ready' && lastReady.current?.state !== state) lastReady.current = { key, state };
  const cached = lastReady.current?.key === key && lastReady.current.state.status === 'ready' ? lastReady.current.state.data : [];
  // Falha ao carregar só deixa a faixa de fora: a fila tem tela própria com o erro.
  const entries = state.status === 'error' ? [] : cached;
  const offers = entries.filter((entry) => entry.offer !== null);
  return { offers, reload };
}
