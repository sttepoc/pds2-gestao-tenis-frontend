import { describe, expect, it } from 'vitest';
import { resolveRoute, routeId } from './navigation';

describe('resolveRoute', () => {
  it.each([
    ['', 'home'],
    ['#', 'home'],
    ['#/membros', 'members'],
    ['#/membros/', 'members'],
    ['#/xyz', 'not-found'],
    ['#/quadras', 'courts'],
    ['#/agenda', 'schedule'],
    ['#/reservas', 'bookings'],
    ['#/reservas/12', 'booking'],
    ['#/agenda/remarcar/12', 'reschedule'],
    ['#/reservas/abc', 'not-found'],
    ['#/reservas/0', 'not-found'],
    ['#/reservas/-1', 'not-found'],
    ['#/reservas/1234567890', 'not-found'],
    ['#/reservas/12/../membros', 'not-found'],
  ])('resolveRoute(%j) -> %s', (hash, route) => {
    expect(resolveRoute(hash)).toBe(route);
  });

  it('routeId lê o id só das rotas com id', () => {
    expect(routeId('#/reservas/12')).toBe(12);
    expect(routeId('#/agenda/remarcar/7')).toBe(7);
    expect(routeId('#/agenda')).toBeNull();
  });
});
