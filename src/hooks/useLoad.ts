import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { errorMessage, isExpired } from '../api/error';

export type Load<T> =
  /** `previous`: últimos dados da mesma chave, para a tela não piscar durante uma recarga. */
  | { status: 'loading'; previous?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

const LOADING = { status: 'loading' } as const;

/**
 * Carrega dados por chave. Trocar a chave volta a "carregando" já no mesmo render
 * (nunca mostra os dados da chave anterior) e respostas atrasadas são descartadas.
 */
export function useLoad<T>(key: string, load: () => Promise<T>, onExpired: () => void) {
  // A chave fica junto do estado: assim o estado de outra chave nunca vaza para a tela.
  const [stored, setStored] = useState<{ key: string; state: Load<T> }>({ key, state: LOADING });
  const [attempt, setAttempt] = useState(0);
  const runLoad = useEffectEvent(load);
  const expire = useEffectEvent(onExpired);

  useEffect(() => {
    let active = true;
    setStored((current) => ({ key, state: { status: 'loading', previous: current.key === key ? lastData(current.state) : undefined } }));
    runLoad().then((data) => {
      if (active) setStored({ key, state: { status: 'ready', data } });
    }).catch((error: unknown) => {
      if (!active) return;
      if (isExpired(error)) return expire();
      setStored({ key, state: { status: 'error', message: errorMessage(error, 'Não foi possível carregar os dados.') } });
    });
    return () => { active = false; };
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  // Aceita o valor ou uma função sobre os dados atuais (aplicada só se já estiverem prontos).
  // Ignora a atualização se a chave mudou: uma resposta atrasada não invade outra lista.
  const setData = useCallback((data: T | ((previous: T) => T)) => {
    setStored((current) => {
      if (current.key !== key) return current;
      if (typeof data !== 'function') return { key, state: { status: 'ready', data } };
      if (current.state.status !== 'ready') return current;
      return { key, state: { status: 'ready', data: (data as (previous: T) => T)(current.state.data) } };
    });
  }, [key]);

  const state: Load<T> = stored.key === key ? stored.state : LOADING;
  return { state, reload, setData };
}

function lastData<T>(state: Load<T>): T | undefined {
  if (state.status === 'ready') return state.data;
  return state.status === 'loading' ? state.previous : undefined;
}
