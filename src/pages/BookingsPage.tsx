import { useState, type ReactNode } from 'react';
import { listBookings } from '../api/bookings';
import type { Booking, Session } from '../api/types';
import { AttendanceActions } from '../components/AttendanceActions';
import { BookingCard } from '../components/BookingCard';
import { CancelBookingAction } from '../components/CancelBookingAction';
import { panelId, tabId, Tabs } from '../components/Tabs';
import { useLoad } from '../hooks/useLoad';
import { routePaths } from '../navigation';

type Props = {
  session: Session;
  onExpired: () => void;
};

type Scope = 'upcoming' | 'past';

// Para somar uma aba, basta acrescentar uma entrada aqui e tratá-la em renderPanel.
const TABS = [
  { id: 'upcoming', label: 'Próximas' },
  { id: 'past', label: 'Anteriores' },
];

const empty: Record<Scope, string> = { upcoming: 'Nenhuma reserva marcada.', past: 'Nenhuma reserva anterior.' };

export function BookingsPage({ session, onExpired }: Props) {
  const [tab, setTab] = useState<string>('upcoming');
  const scope = tab as Scope;
  const [notice, setNotice] = useState('');
  const { state, reload, setData } = useLoad(
    `bookings:${scope}`,
    async () => ({ scope, items: await listBookings(session.token, scope) }),
    onExpired,
  );

  function renderPanel(): ReactNode {
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
            <AttendanceActions booking={item} session={session} onChange={replace} onExpired={onExpired} />
            <CancelBookingAction booking={item} session={session} onCancelled={remove} onExpired={onExpired} />
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
      <section className="content-panel" aria-label="Minhas reservas">
        {notice && <p className="notice" role="status">{notice}</p>}
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
          {renderPanel()}
        </div>
      </section>
      <a className="text-link" href={routePaths.home}>Voltar ao início <span aria-hidden="true">→</span></a>
    </>
  );
}
