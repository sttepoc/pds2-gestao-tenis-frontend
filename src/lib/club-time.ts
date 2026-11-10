export const CLUB_TIME_ZONE = 'America/Sao_Paulo';
// O Brasil não tem horário de verão desde 2019, então o deslocamento do clube é fixo.
export const CLUB_UTC_OFFSET = '-03:00';

const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLUB_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLUB_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const labelFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CLUB_TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short',
});
const weekdayFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' });
const longDayFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CLUB_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long',
});

/** Dia por extenso no fuso do clube, como "Segunda-feira, 9 de novembro". */
export function clubLongDay(value: number): string {
  const label = longDayFormat.format(new Date(value));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function clubDate(value: string | number): string {
  return dateFormat.format(new Date(value));
}

export function clubTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function nextClubDays(now: number, count: number): string[] {
  const [year, month, day] = clubDate(now).split('-').map(Number);
  return Array.from({ length: count }, (_, offset) =>
    new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10));
}

export function dayParts(date: string): { weekday: string; day: string } {
  const moment = new Date(`${date}T12:00:00Z`);
  return {
    weekday: weekdayFormat.format(moment).replace('.', '').toUpperCase(),
    day: date.slice(8, 10),
  };
}

export function clubDateLabel(iso: string): string {
  return labelFormat.format(new Date(iso));
}

export function formatClubDateTime(iso: string): string {
  return `${labelFormat.format(new Date(iso))} · ${clubTime(iso)}`;
}

export function fromClubLocal(local: string): string {
  return `${local}:00${CLUB_UTC_OFFSET}`;
}
