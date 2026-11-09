import { useMemo, useRef, useState, type ReactNode } from 'react';
import { getBooking, getSchedule } from '../api/bookings';
import { ApiError } from '../api/error';
import type { Booking, Schedule, Session, Slot, SlotRef, WaitlistEntry } from '../api/types';
import { BookingPanel } from '../components/BookingPanel';
import { RescheduleBanner } from '../components/RescheduleBanner';
import { ReschedulePanel } from '../components/ReschedulePanel';
import { DayStrip } from '../components/DayStrip';
import { isClosed, ScheduleGrid } from '../components/ScheduleGrid';
import { WaitlistPanel } from '../components/WaitlistPanel';
import { useLoad } from '../hooks/useLoad';
import { clubDate, clubTime, formatClubDateTime, nextClubDays } from '../lib/club-time';
import { bookingPath, routePaths } from '../navigation';

type Props = {
  session: Session;
  onExpired: () => void;
  /** Reserva sendo remarcada; `null` no modo normal. */
  rescheduleId?: number | null;
  now?: () => number;
};

export function SchedulePage({ rescheduleId = null, ...props }: Props) {
  return rescheduleId === null ? <Agenda {...props} /> : <RescheduleAgenda id={rescheduleId} {...props} />;
}

// Carrega a reserva a remarcar antes de abrir a agenda.
function RescheduleAgenda({ id, ...props }: Omit<Props, 'rescheduleId'> & { id: number }) {
  const { session, onExpired } = props;
  const loadBooking = () => getBooking(session.token, id).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  const { state, reload } = useLoad(`reschedule:${id}`, loadBooking, onExpired);
  const back = <a className="text-link" href={routePaths.bookings}><span aria-hidden="true">←</span> Minhas reservas</a>;
  if (state.status === 'loading') {
    return <p className="status-line" role="status"><span className="rally" aria-hidden="true" />Carregando reserva…</p>;
  }
  if (state.status === 'error') {
    return (
      <>
        <section className="content-panel empty-panel">
          <h1>Não foi possível abrir a reserva</h1>
          <p className="alert" role="alert">{state.message}</p>
          <button className="button button--secondary" type="button" onClick={reload}>Tentar novamente</button>
        </section>
        {back}
      </>
    );
  }
  if (state.data === null) {
    return (
      <>
        <section className="content-panel empty-panel">
          <h1>Reserva não encontrada</h1>
          <p>Ela pode ter sido removida ou não ser sua.</p>
        </section>
        {back}
      </>
    );
  }
  return <Agenda {...props} booking={state.data} />;
}

function Agenda({ session, onExpired, booking, now = Date.now }: Omit<Props, 'rescheduleId'> & { booking?: Booking }) {
  const days = useMemo(() => nextClubDays(now(), 7), [now]);
  const [date, setDate] = useState(() => {
    const own = booking && clubDate(booking.starts_at);
    return own && days.includes(own) ? own : days[0];
  });
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [courtId, setCourtId] = useState<number | null>(null);
  const [booked, setBooked] = useState<Booking | null>(null);
  const [conflict, setConflict] = useState<(SlotRef & { message: string }) | null>(null);
  const [queued, setQueued] = useState<WaitlistEntry | null>(null);
  const lastSchedule = useRef<Schedule | null>(null);
  const { state, reload } = useLoad(`schedule:${date}`, () => getSchedule(session.token, date), onExpired);

  function changeDate(next: string) {
    setDate(next);
    select(null);
  }

  function select(item: SlotRef | null) {
    // O horário atual da reserva remarcada não abre nada.
    if (item && booking && item.court_id === booking.court.id &&
      Date.parse(item.starts_at) === Date.parse(booking.starts_at)) return;
    setSelected(item && { court_id: item.court_id, starts_at: item.starts_at });
    setBooked(null);
    setConflict(null);
    setQueued(null);
  }

  function renderPanel(slot: Slot, courtName: string): ReactNode {
    if (slot.status === 'maintenance') return <p>Quadra em manutenção nesse horário.</p>;
    // Escolhido antes de começar: o relógio andou e o formulário não volta mais.
    if (isClosed(slot, now())) return <p>Esse horário já passou.</p>;
    // Antes mesmo da recarga: o formulário some assim que a reserva é criada, sem segundo envio.
    if (booked && booked.court.id === slot.court_id && Date.parse(booked.starts_at) === Date.parse(slot.starts_at)) {
      return (
        <div className="notice" role="status">
          <p>Reserva confirmada.</p>
          <a className="text-link" href={bookingPath(booked.id)}>Ver reserva</a>
        </div>
      );
    }
    const conflictHere = conflict && conflict.court_id === slot.court_id && conflict.starts_at === slot.starts_at;
    if (booking && (slot.status === 'free' || conflictHere)) {
      return (
        <ReschedulePanel
          key={`${slot.court_id}:${slot.starts_at}`}
          booking={booking} slot={slot} courtName={courtName} session={session}
          conflictMessage={conflictHere ? conflict.message : ''}
          onDone={(moved) => { window.location.hash = bookingPath(moved.id); }}
          onConflict={(message) => { setConflict({ court_id: slot.court_id, starts_at: slot.starts_at, message }); reload(); }}
          onExpired={onExpired}
        />
      );
    }
    if (slot.status === 'free' || conflictHere) {
      return (
        <BookingPanel
          key={`${slot.court_id}:${slot.starts_at}`}
          slot={slot} courtName={courtName} session={session}
          conflictMessage={conflictHere ? conflict.message : ''}
          canQueue={slot.status === 'booked'}
          onBooked={(booking) => { setConflict(null); setBooked(booking); reload(); }}
          onQueued={(entry) => { setConflict(null); setQueued(entry); reload(); }}
          onConflict={(message) => { setConflict({ court_id: slot.court_id, starts_at: slot.starts_at, message }); reload(); }}
          onExpired={onExpired}
        />
      );
    }
    if (slot.status === 'booked' && !booking) {
      const own = queued && queued.court.id === slot.court_id && Date.parse(queued.starts_at) === Date.parse(slot.starts_at);
      return (
        <WaitlistPanel
          key={`${slot.court_id}:${slot.starts_at}`}
          slot={slot} courtName={courtName} session={session}
          initial={own ? { id: queued.id, position: queued.position } : null}
          onChange={reload} onExpired={onExpired}
        />
      );
    }
    return null;
  }

  function renderBody(schedule: Schedule) {
    if (schedule.courts.length === 0) return <p className="muted">Nenhuma quadra cadastrada ainda.</p>;
    lastSchedule.current = schedule;
    const activeCourtId = schedule.courts.some((court) => court.id === courtId) ? courtId! : schedule.courts[0].id;
    const slot = selected && schedule.slots.find((item) =>
      item.court_id === selected.court_id && item.starts_at === selected.starts_at);
    const court = slot && schedule.courts.find((item) => item.id === slot.court_id);
    return (
      <div className="schedule-layout">
        <ScheduleGrid
          schedule={schedule} selected={selected} onSelect={select}
          activeCourtId={activeCourtId} onCourtChange={setCourtId} now={now()}
        />
        {slot && court && (
          <aside className="side-panel" aria-label="Horário selecionado">
            <h2>{court.name}</h2>
            <p className="muted">{formatClubDateTime(slot.starts_at)} às {clubTime(slot.ends_at)}</p>
            {renderPanel(slot, court.name)}
          </aside>
        )}
      </div>
    );
  }

  let content: ReactNode;
  // Depois de trocar o dia, o primeiro render ainda traz a grade do dia anterior.
  if (state.status === 'loading' && lastSchedule.current?.date === date) {
    // Recarga depois de reservar: mantém grade e painel montados, sem piscar.
    content = renderBody(lastSchedule.current);
  } else if (state.status === 'loading' || (state.status === 'ready' && state.data.date !== date)) {
    content = <p className="status-line" role="status"><span className="rally" aria-hidden="true" />Carregando agenda…</p>;
  } else if (state.status === 'error') {
    content = (
      <div className="access-feedback">
        <p className="alert" role="alert">{state.message}</p>
        <button className="button button--secondary" type="button" onClick={reload}>Tentar novamente</button>
      </div>
    );
  } else {
    content = renderBody(state.data);
  }

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">QUADRAS</p>
        <h1>Agenda</h1>
        <p>{booking ? 'Escolha o dia e o novo horário livre da sua reserva.' : 'Escolha o dia e um horário livre para reservar.'}</p>
      </div>
      <section className="content-panel" aria-label="Agenda das quadras">
        {booking && <RescheduleBanner booking={booking} />}
        <DayStrip days={days} value={date} onChange={changeDate} />
        {content}
      </section>
      <a className="text-link" href={routePaths.home}>Voltar ao início <span aria-hidden="true">→</span></a>
    </>
  );
}
