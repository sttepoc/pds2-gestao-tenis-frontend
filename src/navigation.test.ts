import { describe, expect, it } from 'vitest';
import { resolveRoute } from './navigation';

describe('resolveRoute', () => {
  it.each([
    ['', 'home'],
    ['#', 'home'],
    ['#/membros', 'members'],
    ['#/membros/', 'members'],
    ['#/xyz', 'not-found'],
  ])('resolveRoute(%j) -> %s', (hash, route) => {
    expect(resolveRoute(hash)).toBe(route);
  });
});
