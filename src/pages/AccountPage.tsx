import type { Session } from '../api/auth';
import { AccessStatus } from '../components/AccessStatus';
import type { MemberAccess } from '../hooks/useMemberAccess';

function dateLabel(value: string, time = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    ...(time ? { timeStyle: 'short' as const } : {}),
  }).format(date);
}

export function AccountPage({ session, access, onRetry }: {
  session: Session;
  access: MemberAccess;
  onRetry: () => void;
}) {
  const accessLabel = {
    allowed: 'Autorizado',
    denied: 'Não autorizado',
    checking: 'Verificando…',
    error: 'Verificação indisponível',
  }[access.status];

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">ÁREA PESSOAL</p>
        <h1>Minha conta</h1>
        <p>Seus dados de acesso, em um só lugar.</p>
      </div>
      <section className="content-panel" aria-labelledby="profile-title">
        <div className="panel-heading">
          <h2 id="profile-title">Dados da conta</h2>
          <span className="badge">Conta de acesso</span>
        </div>
        <dl className="details-grid">
          <div><dt>Nome</dt><dd>{session.user.name}</dd></div>
          <div><dt>E-mail</dt><dd>{session.user.email}</dd></div>
          <div><dt>Conta criada em</dt><dd>{dateLabel(session.user.created_at)}</dd></div>
          <div><dt>Acesso administrativo</dt><dd>{accessLabel}</dd></div>
        </dl>
      </section>
      <section className="content-panel session-panel" aria-labelledby="session-title">
        <div className="panel-heading">
          <h2 id="session-title">Sua sessão</h2>
          <span className="badge badge--active">Ativa</span>
        </div>
        <p>Esta sessão expira em <strong>{dateLabel(session.expiresAt, true)}</strong>.</p>
        <p className="muted">Ao terminar, use “Sair da conta” para encerrar seu acesso neste navegador.</p>
      </section>
      <section className="permission-note" aria-label="Permissões da conta">
        <AccessStatus access={access} onRetry={onRetry} />
      </section>
    </>
  );
}
