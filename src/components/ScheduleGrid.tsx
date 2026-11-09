import type { Schedule, Slot, SlotRef, SlotStatus } from '../api/types';
import { clubTime } from '../lib/club-time';

type Props = {
  schedule: Schedule;
  selected: SlotRef | null;
  onSelect(slot: Slot): void;
  activeCourtId: number;
  onCourtChange(id: number): void;
};

const LABELS: Record<SlotStatus, string> = {
  free: 'livre', booked: 'ocupado', mine: 'sua reserva', maintenance: 'em manutenção',
};

const LEGEND: [SlotStatus, string][] = [
  ['free', 'Livre'], ['booked', 'Ocupado'], ['mine', 'Sua reserva'], ['maintenance', 'Manutenção'],
];

export function ScheduleGrid({ schedule, selected, onSelect, activeCourtId, onCourtChange }: Props) {
  const { courts, slots } = schedule;
  const times = Array.from(new Set(slots.map((slot) => slot.starts_at))).sort();
  const byKey = new Map(slots.map((slot) => [`${slot.court_id}|${slot.starts_at}`, slot]));

  return (
    <div className="schedule">
      <div className="court-tabs" role="tablist" aria-label="Quadras">
        {courts.map((court) => (
          <button
            key={court.id} type="button" role="tab" aria-selected={court.id === activeCourtId}
            onClick={() => onCourtChange(court.id)}
          >
            {court.name}
          </button>
        ))}
      </div>
      <div className="schedule-scroll">
        <div className="schedule-grid" style={{ gridTemplateColumns: `4rem repeat(${courts.length}, minmax(5.5rem, 1fr))` }}>
          <span className="schedule-corner" aria-hidden="true" />
          {courts.map((court) => (
            <span key={court.id} className={`schedule-court${court.id === activeCourtId ? ' is-active' : ''}`}>{court.name}</span>
          ))}
          {times.map((time) => (
            <div key={time} className="schedule-row">
              <span className="schedule-time">{clubTime(time)}</span>
              {courts.map((court) => {
                const slot = byKey.get(`${court.id}|${time}`);
                if (!slot) return <span key={court.id} className="schedule-gap" />;
                const isSelected = selected?.court_id === slot.court_id && selected.starts_at === slot.starts_at;
                const maintenance = slot.status === 'maintenance';
                return (
                  <button
                    key={court.id} type="button"
                    className={`slot slot--${slot.status}${court.id === activeCourtId ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                    aria-label={`${court.name}, ${clubTime(slot.starts_at)}, ${LABELS[slot.status]}`}
                    aria-disabled={maintenance ? 'true' : undefined}
                    aria-pressed={maintenance ? undefined : isSelected}
                    onClick={() => onSelect(slot)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <ul className="schedule-legend" aria-label="Legenda">
        {LEGEND.map(([status, text]) => (
          <li key={status}><span className={`slot-swatch slot--${status}`} aria-hidden="true" />{text}</li>
        ))}
      </ul>
    </div>
  );
}
