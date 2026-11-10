import type { Session } from '../api/types';
import { AccessStatus } from '../components/AccessStatus';
import { OfferBanners } from '../components/OfferBanner';
import type { MemberAccess } from '../hooks/useMemberAccess';
import { routePaths } from '../navigation';

type Props = { session: Session; access: MemberAccess; onRetry: () => void; onExpired: () => void };

const links = [
  { href: routePaths.schedule, title: 'Agenda', text: 'Veja os horários das quadras e reserve o seu.', action: 'Ver agenda' },
  { href: routePaths.bookings, title: 'Minhas reservas', text: 'Acompanhe as reservas que você marcou ou recebeu.', action: 'Ver reservas' },
  { href: routePaths.account, title: 'Minha conta', text: 'Consulte seus dados e as informações da sua sessão.', action: 'Ver minha conta' },
  { href: routePaths.members, title: 'Membros', text: 'Acesse a área administrativa de membros do clube.', action: 'Acessar área', admin: true },
];

export function HomePage({ session, access, onRetry, onExpired }: Props) {
  const firstName = session.user.name.trim().split(/\s+/)[0];
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Seu espaço no clube</p>
        <h1>Olá, {firstName}.</h1>
        <p>Bom ter você por aqui. O que vamos organizar hoje?</p>
      </div>
      <OfferBanners session={session} onExpired={onExpired} />
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div>
          <p className="eyebrow">Dentro e fora de quadra</p>
          <h2 id="welcome-title">Tudo começa com<br />um clube organizado.</h2>
          <p>Acesse seus dados e encontre as áreas disponíveis para sua conta.</p>
        </div>
        <div className="mini-court" aria-hidden="true"><span /><i /></div>
      </section>
      <section aria-labelledby="quick-access-title">
        <div className="section-heading">
          <h2 id="quick-access-title">Acesso rápido</h2>
          <span>Seu dia a dia no clube</span>
        </div>
        <ul className="quick-links">
          {links.filter((link) => !link.admin || access.status === 'allowed').map((link) => (
            <li key={link.href}>
              <a className="quick-link" href={link.href}>
                <span className="quick-link-text">
                  <strong>{link.title}</strong>
                  <span>{link.text}</span>
                </span>
                <span className="quick-link-action">{link.action}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="permission-note" aria-label="Permissões da conta">
        <AccessStatus access={access} onRetry={onRetry} />
      </section>
    </>
  );
}
