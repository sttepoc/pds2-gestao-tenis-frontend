import type { MemberAccess } from '../hooks/useMemberAccess';

export function AccessStatus({ access, onRetry }: { access: MemberAccess; onRetry: () => void }) {
  if (access.status === 'checking') return (
    <p className="status-line" role="status">
      <span className="rally" aria-hidden="true" />Verificando acesso administrativo…
    </p>
  );
  if (access.status === 'error') return (
    <div className="access-feedback" role="alert">
      <p>Não foi possível verificar seu acesso administrativo.</p>
      <p className="muted">{access.message}</p>
      <button className="button button--secondary" type="button" onClick={onRetry}>Tentar novamente</button>
    </div>
  );
  return <p className="muted">{access.status === 'allowed' ? 'Acesso administrativo confirmado.' : 'Sua conta tem acesso à área pessoal do clube.'}</p>;
}
