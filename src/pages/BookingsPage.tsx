import { useState, type ReactNode } from 'react';
import { listBookings } from '../api/bookings';
import type { Booking, Session, WaitlistEntry } from '../api/types';
import { AttendanceActions } from '../components/AttendanceActions';
import { BookingCard } from '../components/BookingCard';
import { CancelBookingAction } from '../components/CancelBookingAction';
import { LoadError, Loading } from '../components/LoadStatus';
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
  // A chave inclui o escopo: trocar de aba nunca mostra a lista da aba anterior,
  // e setData de uma resposta atrasada não altera a lista do outro escopo.
  const { state, reload, setData } = useLoad(`bookings:${scope}`, () => listBookings(session.token, scope), onExpired);

  function changeTab(id: string) {
    setTab(id);
    if (id === 'upcoming' || id === 'past') setScope(id);
  }

  function renderWaitlist(): ReactNode {
    if (waitlist.state.status === 'loading') return <Loading>Carregando fila…</Loading>;
    if (waitlist.state.status === 'error') return <LoadError message={waitlist.state.message} onRetry={waitlist.reload} />;
    const left = (entry: WaitlistEntry) => waitlist.setData((latest) => latest.filter((item) => item.id !== entry.id));
    return <WaitlistList entries={waitlist.state.data} session={session} onChange={left} onExpired={onExpired} />;
  }

  function renderPanel(): ReactNode {
    if (tab === 'waitlist') return renderWaitlist();
    if (state.status === 'loading') return <Loading>Carregando reservas…</Loading>;
    if (state.status === 'error') return <LoadError message={state.message} onRetry={reload} />;
    const items = state.data;
    if (items.length === 0) {
      return (
        <div className="empty-state">
          <p className="muted">{empty[scope]}</p>
          {scope === 'upcoming' && <a className="text-link" href={routePaths.schedule}>Ver agenda</a>}
        </div>
      );
    }
    // Mescla na lista mais recente do mesmo escopo (o useLoad ignora se a aba já mudou).
    const replace = (updated: Booking) =>
      setData((latest) => latest.map((item) => (item.id === updated.id ? updated : item)));
    // A reserva cancelada sai de Próximas; em Anteriores ela aparece quando a aba carregar.
    const remove = (cancelled: Booking) => {
      setData((latest) => latest.filter((item) => item.id !== cancelled.id));
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
        <p className="eyebrow">Quadras</p>
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
