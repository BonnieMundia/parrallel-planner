import { usePlanner } from '../../app/store';
import { SEED_STREAMS } from '../../domain/seed';
import { ruleCounts, tasks } from '../../domain/select';
import styles from './Screens.module.css';

const RULE_LONG: Record<string, string> = {
  Clock: 'a clock',
  Place: 'a place',
  Nothing: 'nothing',
  Mixed: 'both, by item',
};

export function Streams() {
  const { state, actions } = usePlanner();
  const all = tasks(state);
  const n = ruleCounts(state);

  return (
    <div className={styles.page}>
      <div className={styles.listLabel}>
        {n.clock} on a clock · {n.place} on a place · {n.none} on nothing
      </div>
      <div className={styles.card}>
        {SEED_STREAMS.map((s, i) => {
          const on = state.stream === s.name;
          return (
            <button
              key={s.name}
              type="button"
              className={styles.streamRow}
              aria-pressed={on}
              style={{
                borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none',
                background: on ? 'rgba(110,128,132,.26)' : 'transparent',
              }}
              onClick={() => actions.setStream(on ? null : s.name)}
            >
              <span className={styles.streamSwatch}>
                <span className={styles.streamDot} style={{ background: s.color }} />
              </span>
              <span className={styles.streamText}>
                <span className={styles.streamName}>{s.name}</span>
                <span className={styles.streamRule}>
                  Locked to {RULE_LONG[s.rule] ?? s.rule}
                </span>
              </span>
              <span className={`${styles.streamCount} tnum`}>
                {all.filter((t) => t.stream === s.name).length}
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" className={styles.settingsRow} onClick={actions.openSettings}>
        Settings
      </button>
    </div>
  );
}
