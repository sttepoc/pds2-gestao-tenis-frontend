export type Route = 'home' | 'account' | 'members' | 'login' | 'not-found';

export const routePaths = {
  home: '#/inicio',
  account: '#/conta',
  members: '#/membros',
  login: '#/entrar',
} as const;

export function resolveRoute(hash: string): Route {
  const path = hash.replace(/\/$/, '');
  if (!path || path === '#') return 'home';
  for (const [route, value] of Object.entries(routePaths)) {
    if (path === value) return route as Route;
  }
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
