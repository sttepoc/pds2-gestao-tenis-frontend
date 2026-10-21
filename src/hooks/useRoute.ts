import { useSyncExternalStore } from 'react';
import { resolveRoute } from '../navigation';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute() {
  return resolveRoute(useSyncExternalStore(subscribe, () => window.location.hash, () => ''));
}
