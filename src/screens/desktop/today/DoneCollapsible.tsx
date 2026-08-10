import { usePlanner } from '../../../app/store';
import type { DoneKey } from '../../../app/store';
import { hhmm } from '../../../app/clock';
import { findTask } from '../../../domain/select';
import type { Rule } from '../../../domain/types';
import styles from './DoneCollapsible.module.css';

/** Completed items leave their list and collect here, each with its own Undo. */
export function DoneCollapsible({ rule, doneKey }: { rule: Rule; doneKey: DoneKey }) {
  const { state, clock, actions } = usePlanner();

  const rows = Object.keys(state.done)
    .map((id) => ({ id, task: findTask(state, id), at: state.done[id] ?? 0 }))
    .filter((r) => r.task?.rule === rule)
    .sort((a, b) => b.at - a.at);

  if (rows.length === 0) return null;
  const open = state.doneOpen === doneKey;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => actions.toggleDone(doneKey)}
      >
        ✓ {rows.length} done · tap to {open ? 'hide' : 'review'}
      </button>
      {open &&
        rows.map((r) => (
          <div key={r.id} className={styles.row}>
            <span className={styles.title}>{r.task?.title}</span>
            <span className={`${styles.at} tnum`}>{hhmm(new Date(r.at), clock.tz)}</span>
            <button type="button" className={styles.undo} onClick={() => actions.undoDone(r.id)}>
              Undo
            </button>
          </div>
        ))}
    </div>
  );
}
