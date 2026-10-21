import { useEffect, useState } from 'react';
import { checkMemberAccess } from '../api/access';
import { ApiError } from '../api/error';

export type MemberAccess =
  | { status: 'checking' | 'allowed' | 'denied' }
  | { status: 'error'; message: string };

export function useMemberAccess(token: string, onExpired: () => void) {
  const [access, setAccess] = useState<MemberAccess>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    checkMemberAccess(token).then((status) => {
      if (active) setAccess({ status });
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) return onExpired();
      setAccess({ status: 'error', message: error instanceof ApiError ? error.message : 'Não foi possível verificar seu acesso.' });
    });
    return () => { active = false; };
  }, [token, attempt, onExpired]);

  function retry() {
    setAccess({ status: 'checking' });
    setAttempt((value) => value + 1);
  }

  return { access, retry };
}
