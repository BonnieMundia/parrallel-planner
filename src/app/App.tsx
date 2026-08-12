import { Suspense, lazy, useSyncExternalStore } from 'react';
import { PlannerProvider } from './store';
import { ErrorBoundary } from './ErrorBoundary';
import { Desktop } from '../screens/desktop/Desktop';
import { Phone } from '../screens/phone/Phone';

/**
 * The prototype ships two artifacts, 1440×900 and 412×892, and names no crossover
 * width. 1200 is derived rather than picked: the sidebar and rail take 552px, the
 * content padding 48 and the column gaps 36, so 1200 leaves 188px a column — the
 * narrowest at which the 24px countdown and the your-clock/their-clock footer still
 * fit without overflowing. At 1000px the columns collapse to 118px and the design
 * stops working; below 1200 the phone layout is the honest answer, since it is the
 * one that was actually drawn for a narrow screen.
 */
const DESKTOP = window.matchMedia('(min-width: 1200px)');

function subscribe(cb: () => void): () => void {
  DESKTOP.addEventListener('change', cb);
  // The media-query change event is not always delivered — a programmatic viewport
  // change can skip it entirely, which strands the app on the wrong layout. resize is
  // the second signal; getSnapshot re-reads `matches` either way, so it stays correct.
  window.addEventListener('resize', cb);
  return () => {
    DESKTOP.removeEventListener('change', cb);
    window.removeEventListener('resize', cb);
  };
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
    <ErrorBoundary>
      <PlannerProvider>{isDesktop ? <Desktop /> : <Phone />}</PlannerProvider>
    </ErrorBoundary>
  );
}
