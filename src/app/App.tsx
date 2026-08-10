import { Suspense, lazy, useSyncExternalStore } from 'react';
import { PlannerProvider } from './store';
import { Desktop } from '../screens/desktop/Desktop';
import styles from './App.module.css';

// The prototype ships two artifacts: desktop at 1440×900 and phone at 412×892.
// Nothing in the handoff names a crossover width; 900 is provisional, pending the designer.
const DESKTOP = window.matchMedia('(min-width: 900px)');

function subscribe(cb: () => void): () => void {
  DESKTOP.addEventListener('change', cb);
  return () => DESKTOP.removeEventListener('change', cb);
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => DESKTOP.matches,
    () => true,
  );
}

// Dev-only primitives harness. Lazy, so it is split into its own chunk that a
// production build emits but never loads — the hash branch is dead outside dev.
const Gallery = lazy(() => import('../dev/Gallery'));

function subscribeHash(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

function useHash(): string {
  return useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => '',
  );
}

export function App() {
  const isDesktop = useIsDesktop();
  const hash = useHash();

  if (import.meta.env.DEV && hash === '#primitives') {
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    );
  }

  return (
    <PlannerProvider>
      {/* The phone layout lands in step 7. */}
      {isDesktop ? <Desktop /> : <div className={styles.phone} />}
    </PlannerProvider>
  );
}
