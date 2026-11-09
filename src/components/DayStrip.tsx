import { dayParts } from '../lib/club-time';

type Props = { days: string[]; value: string; onChange(date: string): void };

export function DayStrip({ days, value, onChange }: Props) {
  return (
    <div className="day-strip" role="group" aria-label="Dia da agenda">
      {days.map((date) => {
        const { weekday, day } = dayParts(date);
        return (
          <button
            key={date} type="button" className="day-strip-item" aria-pressed={date === value}
            aria-label={`${weekday} ${day}`} onClick={() => onChange(date)}
          >
            <span aria-hidden="true">{weekday}</span>
            <strong aria-hidden="true">{day}</strong>
          </button>
        );
      })}
    </div>
  );
}
