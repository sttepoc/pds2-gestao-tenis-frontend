import { describe, expect, it } from 'vitest';
import { clubDate, clubTime, dayParts, formatClubDateTime, fromClubLocal, nextClubDays } from './club-time';

describe('club-time', () => {
  it('clubDate usa o fuso do clube perto da meia-noite', () => {
    expect(clubDate('2026-11-10T02:30:00Z')).toBe('2026-11-09');
  });
  it('clubTime', () => expect(clubTime('2026-11-10T21:00:00Z')).toBe('18:00'));
  it('nextClubDays começa no hoje do clube', () => {
    expect(nextClubDays(Date.parse('2026-11-10T01:00:00Z'), 3)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
  });
  it('nextClubDays atravessa o fim do mês', () => {
    expect(nextClubDays(Date.parse('2026-11-29T15:00:00Z'), 3)).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
  });
  it('fromClubLocal', () => expect(fromClubLocal('2026-11-10T18:00')).toBe('2026-11-10T18:00:00-03:00'));
  it('dayParts', () => expect(dayParts('2026-11-10')).toEqual({ weekday: 'TER', day: '10' }));
  it('formatClubDateTime', () => {
    expect(formatClubDateTime('2026-11-10T21:00:00Z')).toBe('ter., 10 de nov. · 18:00');
  });
});
