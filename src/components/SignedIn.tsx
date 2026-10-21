import { useEffect, useId, useRef, useTransition } from 'react';
import type { Session } from '../api/auth';

type Props = {
  session: Session;
  onLogout: () => Promise<void>;
};

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Tela provisória depois do login, até existir o painel do jogador.
export function SignedIn({ session, onLogout }: Props) {
  const id = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [leaving, startLeaving] = useTransition();
  const firstName = session.user.name.trim().split(/\s+/)[0];

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section className="card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} ref={titleRef} tabIndex={-1} className="card-title">
        Olá, {firstName}.
      </h2>
      <p className="card-lead">
        Você entrou como <strong>{session.user.email}</strong>. Sua sessão vale até as{' '}
        {timeFormat.format(new Date(session.expiresAt))}.
      </p>
      <button type="button" className="submit submit--quiet" onClick={() => startLeaving(onLogout)} disabled={leaving}>
        {leaving ? 'Saindo…' : 'Sair'}
      </button>
    </section>
  );
}
