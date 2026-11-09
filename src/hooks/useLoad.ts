import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, isExpired } from '../api/error';

export type Load<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

export function useLoad<T>(key: string, load: () => Promise<T>, onExpired: () => void) {
  const [state, setState] = useState<Load<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  const expiredRef = useRef(onExpired);
  loadRef.current = load;
  expiredRef.current = onExpired;

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loadRef.current().then((data) => {
      if (active) setState({ status: 'ready', data });
    }).catch((error: unknown) => {
      if (!active) return;
      if (isExpired(error)) return expiredRef.current();
      setState({ status: 'error', message: errorMessage(error, 'Não foi possível carregar os dados.') });
    });
    return () => { active = false; };
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  // Aceita o valor ou uma função que parte dos dados atuais (só aplicada se já estiver pronto).
  const setData = useCallback((data: T | ((previous: T) => T)) => {
    setState((current) => {
      if (typeof data !== 'function') return { status: 'ready', data };
      return current.status === 'ready' ? { status: 'ready', data: (data as (previous: T) => T)(current.data) } : current;
    });
  }, []);

  return { state, reload, setData };
}
