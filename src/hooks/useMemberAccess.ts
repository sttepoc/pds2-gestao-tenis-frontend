import { useEffect, useEffectEvent, useState } from 'react';
import { checkMemberAccess } from '../api/access';
import { errorMessage, isExpired } from '../api/error';

export type MemberAccess =
  | { status: 'checking' | 'allowed' | 'denied' }
  | { status: 'error'; message: string };

export function useMemberAccess(token: string, onExpired: () => void) {
  const [access, setAccess] = useState<MemberAccess>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const expire = useEffectEvent(onExpired);

  useEffect(() => {
    let active = true;
    checkMemberAccess(token).then((status) => {
      if (active) setAccess({ status });
    }).catch((error: unknown) => {
      if (!active) return;
      if (isExpired(error)) return expire();
      setAccess({ status: 'error', message: errorMessage(error, 'Não foi possível verificar seu acesso.') });
    });
    return () => { active = false; };
  }, [token, attempt]);

  function retry() {
    setAccess({ status: 'checking' });
    setAttempt((value) => value + 1);
  }

  return { access, retry };
}
