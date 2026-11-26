import { useSyncExternalStore } from 'react';

// Keep this breakpoint aligned with the workbench media query in styles.css.
const query = window.matchMedia('(max-width: 850px)');
const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const getSnapshot = () => query.matches;

export function useCompactLayout() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
