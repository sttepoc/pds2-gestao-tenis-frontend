import { useState, type ReactNode } from 'react';
import { listBookings } from '../api/bookings';
import type { Booking, Session, WaitlistEntry } from '../api/types';
import { AttendanceActions } from '../components/AttendanceActions';
import { BookingCard } from '../components/BookingCard';
import { CancelBookingAction } from '../components/CancelBookingAction';
import { OfferBanners } from '../components/OfferBanner';
import { RescheduleLink } from '../components/RescheduleLink';
import { WaitlistList } from '../components/WaitlistList';
import { panelId, tabId, Tabs } from '../components/Tabs';
import { listWaitlist } from '../api/waitlist';
import { useLoad } from '../hooks/useLoad';
import { routePaths } from '../navigation';

type Props = {
  session: Session;
  onExpired: () => void;
  now?: () => number;
};

type Scope = 'upcoming' | 'past';

// Para somar uma aba, basta acrescentar uma entrada aqui e tratá-la em renderPanel.
const tabsFor = (waitlistCount: number | null) => [
  { id: 'upcoming', label: 'Próximas' },
  { id: 'past', label: 'Anteriores' },
  { id: 'waitlist', label: waitlistCount === null ? 'Fila de espera' : `Fila de espera (${waitlistCount})` },
];

const empty: Record<Scope, string> = { upcoming: 'Nenhuma reserva marcada.', past: 'Nenhuma reserva anterior.' };

export function BookingsPage({ session, onExpired, now }: Props) {
  const [tab, setTab] = useState<string>('upcoming');
  // A aba da fila não muda o escopo: as reservas carregadas continuam valendo.
  const [scope, setScope] = useState<Scope>('upcoming');
  const [notice, setNotice] = useState('');
  const waitlist = useLoad('waitlist', () => listWaitlist(session.token), onExpired);

  function changeTab(id: string) {
    setTab(id);
    if (id === 'upcoming' || id === 'past') setScope(id);
  }

  function renderWaitlist(): ReactNode {
    if (waitlist.state.status === 'loading') {
      return <p className="status-line" role="status"><span className="rally" aria-hidden="true" />Carregando fila…</p>;
    }
    if (waitlist.state.status === 'error') {
      return (
        <div className="access-feedback">
          <p className="alert" role="alert">{waitlist.state.message}</p>
          <button className="button button--secondary" type="button" onClick={waitlist.reload}>Tentar novamente</button>
        </div>
      );
    }
    const left = (entry: WaitlistEntry) => waitlist.setData((latest) => latest.filter((item) => item.id !== entry.id));
    return <WaitlistList entries={waitlist.state.data} session={session} onChange={left} onExpired={onExpired} />;
  }
  const { state, reload, setData } = useLoad(
    `bookings:${scope}`,
    async () => ({ scope, items: await listBookings(session.token, scope) }),
    onExpired,
  );

  function renderPanel(): ReactNode {
    if (tab === 'waitlist') return renderWaitlist();
    // No primeiro render depois de trocar de aba ainda vem a lista da aba anterior.
    if (state.status === 'loading' || (state.status === 'ready' && state.data.scope !== scope)) {
      return <p className="status-line" role="status"><span className="rally" aria-hidden="true" />Carregando reservas…</p>;
    }
    if (state.status === 'error') {
      return (
        <div className="access-feedback">
          <p className="alert" role="alert">{state.message}</p>
          <button className="button button--secondary" type="button" onClick={reload}>Tentar novamente</button>
        </div>
      );
    }
    const items: Booking[] = state.data.items;
    if (items.length === 0) {
      return (
        <div className="empty-state">
          <p className="muted">{empty[scope]}</p>
          {scope === 'upcoming' && <a className="text-link" href={routePaths.schedule}>Ver agenda</a>}
        </div>
      );
    }
    // Mescla na lista mais recente, e só se ela ainda for a das próximas.
    const replace = (updated: Booking) =>
      setData((latest) => latest.scope !== 'upcoming' ? latest
        : { ...latest, items: latest.items.map((item) => (item.id === updated.id ? updated : item)) });
    // A reserva cancelada sai de Próximas; em Anteriores ela aparece quando a aba carregar.
    const remove = (cancelled: Booking) => {
      setData((latest) => latest.scope !== 'upcoming' ? latest
        : { ...latest, items: latest.items.filter((item) => item.id !== cancelled.id) });
      setNotice('Reserva cancelada.');
    };
    return (
      <div className="booking-list">
        {items.map((item) => (
          <BookingCard key={item.id} booking={item}>
            <AttendanceActions booking={item} session={session} onChange={replace} onExpired={onExpired} now={now} />
            <RescheduleLink booking={item} now={now} />
            <CancelBookingAction booking={item} session={session} onCancelled={remove} onExpired={onExpired} now={now} />
          </BookingCard>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">QUADRAS</p>
        <h1>Minhas reservas</h1>
        <p>Acompanhe os horários que você marcou ou para os quais foi convidado.</p>
      </div>
      {/* Aceitar cria uma reserva e recusar tira a entrada: as duas listas recarregam. */}
      <OfferBanners session={session} onExpired={onExpired} onChange={() => { reload(); waitlist.reload(); }} />
      <section className="content-panel" aria-label="Minhas reservas">
        {notice && <p className="notice" role="status">{notice}</p>}
        <Tabs tabs={tabsFor(waitlist.state.status === 'ready' ? waitlist.state.data.length : null)} value={tab} onChange={changeTab} />
        <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
          {renderPanel()}
        </div>
      </section>
      <a className="text-link" href={routePaths.home}>Voltar ao início <span aria-hidden="true">→</span></a>
    </>
  );
}
