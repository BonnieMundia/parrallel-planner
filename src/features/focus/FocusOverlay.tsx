import { usePlanner } from '../../app/store';
import { findTask } from '../../domain/select';
import { INK } from '../../ui/tokens';
import styles from './FocusOverlay.module.css';

/** Full-screen takeover. Everything else is hidden on purpose. */
export function FocusOverlay({ variant }: { variant: 'desktop' | 'phone' }) {
  const { state, actions } = usePlanner();
  const f = state.focus;
  if (!f) return null;

  const task = findTask(state, f.id);
  const color = f.done ? INK.green : f.paused ? INK.amber : INK.link;
  const clock = `${String(Math.floor(f.left / 60)).padStart(2, '0')}:${String(f.left % 60).padStart(2, '0')}`;
  const pct = (1 - f.left / (f.mins * 60)) * 100;

  const status = f.done
    ? 'Block finished — tick it off or take the time back'
    : f.paused
      ? 'Paused. The clock is not running.'
      : 'Running. Everything else is hidden on purpose.';

  return (
    <div
      className={`${styles.overlay} ${variant === 'phone' ? styles.phone : styles.desktop}`}
      role="dialog"
      aria-modal="true"
      aria-label="Focus block"
    >
      <div className={styles.head}>
        <span className={styles.kicker} style={{ color }}>
          {f.mins} min block
          {variant === 'desktop' && task ? ` · ${task.stream}` : ''}
        </span>
        <span className={styles.title}>{task?.title ?? ''}</span>
      </div>

      <div className={`${styles.clock} tnum`} style={{ color }}>
        {clock}
      </div>

      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%`, background: color }} />
      </div>

      <div className={styles.status}>{status}</div>

      <div className={styles.actions}>
        <button type="button" className={styles.done} onClick={() => actions.stopFocus(true)}>
          Tick it off
        </button>
        <div className={styles.pair}>
          <button type="button" className={styles.pause} onClick={actions.pauseFocus}>
            {f.paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className={styles.stop} onClick={() => actions.stopFocus(false)}>
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
