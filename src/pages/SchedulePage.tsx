import { useMemo, useRef, useState, type ReactNode } from 'react';
import { getSchedule } from '../api/bookings';
import type { Booking, Schedule, Session, Slot, SlotRef } from '../api/types';
import { BookingPanel } from '../components/BookingPanel';
import { DayStrip } from '../components/DayStrip';
import { ScheduleGrid } from '../components/ScheduleGrid';
import { useLoad } from '../hooks/useLoad';
import { clubTime, formatClubDateTime, nextClubDays } from '../lib/club-time';
import { bookingPath, routePaths } from '../navigation';

type Props = {
  session: Session;
  onExpired: () => void;
  /** Reserva sendo remarcada (Task 11); `null` no modo normal. */
  rescheduleId?: number | null;
  now?: () => number;
};

export function SchedulePage({ session, onExpired, now = Date.now }: Props) {
  const days = useMemo(() => nextClubDays(now(), 7), [now]);
  const [date, setDate] = useState(days[0]);
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [courtId, setCourtId] = useState<number | null>(null);
  const [booked, setBooked] = useState<Booking | null>(null);
  const [conflict, setConflict] = useState<(SlotRef & { message: string }) | null>(null);
  const lastSchedule = useRef<Schedule | null>(null);
  const { state, reload } = useLoad(`schedule:${date}`, () => getSchedule(session.token, date), onExpired);

  function changeDate(next: string) {
    setDate(next);
    select(null);
  }

  function select(item: SlotRef | null) {
    setSelected(item && { court_id: item.court_id, starts_at: item.starts_at });
    setBooked(null);
    setConflict(null);
  }

  // Único ponto onde as próximas tasks encaixam WaitlistPanel e ReschedulePanel.
  function renderPanel(slot: Slot, courtName: string): ReactNode {
    if (slot.status === 'maintenance') return <p>Quadra em manutenção nesse horário.</p>;
    if (slot.status === 'mine' && booked && booked.id === slot.booking_id) {
      return (
        <div className="notice" role="status">
          <p>Reserva confirmada.</p>
          <a className="text-link" href={bookingPath(booked.id)}>Ver reserva</a>
        </div>
      );
    }
    const conflictHere = conflict && conflict.court_id === slot.court_id && conflict.starts_at === slot.starts_at;
    if (slot.status === 'free' || conflictHere) {
      return (
        <BookingPanel
          key={`${slot.court_id}:${slot.starts_at}`}
          slot={slot} courtName={courtName} session={session}
          conflictMessage={conflictHere ? conflict.message : ''}
          onBooked={(booking) => { setConflict(null); setBooked(booking); reload(); }}
          onConflict={(message) => { setConflict({ court_id: slot.court_id, starts_at: slot.starts_at, message }); reload(); }}
          onExpired={onExpired}
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
          activeCourtId={activeCourtId} onCourtChange={setCourtId}
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
        <p>Escolha o dia e um horário livre para reservar.</p>
      </div>
      <section className="content-panel" aria-label="Agenda das quadras">
        <DayStrip days={days} value={date} onChange={changeDate} />
        {content}
      </section>
      <a className="text-link" href={routePaths.home}>Voltar ao início <span aria-hidden="true">→</span></a>
    </>
  );
}
