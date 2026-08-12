import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { DEFAULTS } from '../domain/seed';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, anything that throws during render leaves a white page with no way
 * back — and the most likely cause is stored state the selectors cannot read, which
 * a reload will hit again. So the recovery offered is the one that actually works:
 * discard the stored session.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Parallel Planner crashed', error, info.componentStack);
  }

  private reset = (): void => {
    try {
      localStorage.removeItem(DEFAULTS.localStorageKey);
    } catch {
      // Nothing more to try; the reload below is still worth attempting.
    }
    location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className={styles.wrap} role="alert">
        <div className={styles.panel}>
          <span className={styles.title}>Something went wrong</span>
          <span className={styles.body}>
            The planner could not draw this screen. Your saved work is still in this
            browser, but if the error repeats it is likely to be the cause.
          </span>
          <span className={styles.detail}>{error.message}</span>
          <div className={styles.actions}>
            <button type="button" className={styles.retry} onClick={() => location.reload()}>
              Reload
            </button>
            <button type="button" className={styles.clear} onClick={this.reset}>
              Clear saved data and reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
