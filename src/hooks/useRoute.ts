import { useSyncExternalStore } from 'react';
import { resolveRoute, routeId, type Route } from '../navigation';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): { route: Route; id: number | null } {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return { route: resolveRoute(hash), id: routeId(hash) };
}
