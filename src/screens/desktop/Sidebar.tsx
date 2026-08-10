import { usePlanner } from '../../app/store';
import { SEED_STREAMS } from '../../domain/seed';
import { byRule, placeName, quota, tasks } from '../../domain/select';
import { Mark } from '../../ui/Mark';
import { CountdownBar } from '../../ui/primitives';
import { PALETTE } from '../../ui/tokens';
import styles from './Sidebar.module.css';

const RULE_LONG: Record<string, string> = {
  Clock: 'a clock',
  Place: 'a place',
  Nothing: 'nothing',
  Mixed: 'both, by item',
};

export function Sidebar() {
  const { state, actions } = usePlanner();
  const all = tasks(state);
  const here = placeName(state, state.here);
  const hereCount = byRule(state, 'place').filter((t) => t.place === state.here).length;
  const q = quota(state);

  return (
    <div className={styles.sidebar}>
      <div className={styles.brand}>
        <Mark size={24} />
        <span className={styles.wordmark}>Parallel</span>
      </div>

      <div className={styles.whereBox}>
        <div className={styles.sectionLabel}>Where am I</div>
        {/* The picker popover lands in step 8; the button is its trigger. */}
        <button type="button" className={styles.where}>
          <span className={styles.whereDot} />
          <span className={styles.whereText}>
            <span className={styles.whereName}>{here}</span>
            <span className={styles.whereNote}>
              {hereCount ? `${hereCount} waiting here` : 'nothing waiting here'}
            </span>
          </span>
          <span className={styles.caret}>▾</span>
        </button>
      </div>

      <div className={`${styles.sectionLabel} ${styles.streamsLabel}`}>Streams</div>
      <div className={styles.streams}>
        {SEED_STREAMS.map((s) => {
          const on = state.stream === s.name;
          return (
            <button
              key={s.name}
              type="button"
              className={`${styles.stream} ${on ? styles.streamOn : ''}`}
              aria-pressed={on}
              onClick={() => actions.setStream(on ? null : s.name)}
            >
              <span className={styles.swatch}>
                <span className={styles.swatchDot} style={{ background: s.color }} />
              </span>
              <span className={styles.streamText}>
                <span className={styles.streamName}>{s.name}</span>
                <span className={styles.streamRule}>{RULE_LONG[s.rule] ?? s.rule}</span>
              </span>
              <span className={`${styles.streamCount} tnum`}>
                {all.filter((t) => t.stream === s.name).length}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.spacer} />

      <div className={styles.defended}>
        <div className={styles.defendedHead}>
          <span className={styles.defendedLabel}>Defended</span>
          <span className={`${styles.defendedValue} tnum`}>{q.label}</span>
        </div>
        <CountdownBar pct={q.pct} color={PALETTE.build} height={6} label="Defended this week" />
        <div className={styles.defendedNote}>Counted only when the work is ticked off.</div>
      </div>
    </div>
  );
}
