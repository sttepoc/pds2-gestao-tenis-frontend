export type Route =
  | 'home' | 'account' | 'members' | 'courts' | 'schedule' | 'reschedule'
  | 'bookings' | 'booking' | 'login' | 'not-found';

export const routePaths = {
  home: '#/inicio',
  account: '#/conta',
  members: '#/membros',
  courts: '#/quadras',
  schedule: '#/agenda',
  bookings: '#/reservas',
  login: '#/entrar',
} as const;

const bookingRoute = /^#\/reservas\/([1-9]\d{0,8})$/;
const rescheduleRoute = /^#\/agenda\/remarcar\/([1-9]\d{0,8})$/;

function normalize(hash: string) {
  return hash.replace(/\/$/, '');
}

export function bookingPath(id: number) {
  return `#/reservas/${id}`;
}

export function reschedulePath(id: number) {
  return `#/agenda/remarcar/${id}`;
}

export function routeId(hash: string): number | null {
  const path = normalize(hash);
  const match = bookingRoute.exec(path) ?? rescheduleRoute.exec(path);
  return match ? Number(match[1]) : null;
}

export function resolveRoute(hash: string): Route {
  const path = normalize(hash);
  if (!path || path === '#') return 'home';
  for (const [route, value] of Object.entries(routePaths)) {
    if (path === value) return route as Route;
  }
  if (bookingRoute.test(path)) return 'booking';
  if (rescheduleRoute.test(path)) return 'reschedule';
  return 'not-found';
}

export function navigate(route: keyof typeof routePaths, replace = false) {
  const hash = routePaths[route];
  if (window.location.hash === hash) return;
  if (replace) {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}
