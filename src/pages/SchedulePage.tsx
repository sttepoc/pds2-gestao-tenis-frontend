import { useMemo, useState, type ReactNode } from 'react';
import { getSchedule } from '../api/bookings';
import type { Schedule, Session, Slot, SlotRef } from '../api/types';
import { DayStrip } from '../components/DayStrip';
import { ScheduleGrid } from '../components/ScheduleGrid';
import { useLoad } from '../hooks/useLoad';
import { clubTime, formatClubDateTime, nextClubDays } from '../lib/club-time';
import { routePaths } from '../navigation';

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
  const { state, reload } = useLoad(`schedule:${date}`, () => getSchedule(session.token, date), onExpired);

  function changeDate(next: string) {
    setDate(next);
    setSelected(null);
  }

  // Único ponto onde as próximas tasks encaixam BookingPanel, WaitlistPanel e ReschedulePanel.
  function renderPanel(slot: Slot): ReactNode {
    if (slot.status === 'maintenance') return <p>Quadra em manutenção nesse horário.</p>;
    return null;
  }

  function renderBody(schedule: Schedule) {
    if (schedule.courts.length === 0) return <p className="muted">Nenhuma quadra cadastrada ainda.</p>;
    const activeCourtId = schedule.courts.some((court) => court.id === courtId) ? courtId! : schedule.courts[0].id;
    const slot = selected && schedule.slots.find((item) =>
      item.court_id === selected.court_id && item.starts_at === selected.starts_at);
    const court = slot && schedule.courts.find((item) => item.id === slot.court_id);
    return (
      <div className="schedule-layout">
        <ScheduleGrid
          schedule={schedule} selected={selected} onSelect={(item) => setSelected({ court_id: item.court_id, starts_at: item.starts_at })}
          activeCourtId={activeCourtId} onCourtChange={setCourtId}
        />
        {slot && court && (
          <aside className="side-panel" aria-label="Horário selecionado">
            <h2>{court.name}</h2>
            <p className="muted">{formatClubDateTime(slot.starts_at)} às {clubTime(slot.ends_at)}</p>
            {renderPanel(slot)}
          </aside>
        )}
      </div>
    );
  }

  let content: ReactNode;
  // Depois de trocar o dia, o primeiro render ainda traz a grade do dia anterior.
  if (state.status === 'loading' || (state.status === 'ready' && state.data.date !== date)) {
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
