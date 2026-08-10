import { usePlanner } from '../../app/store';
import { absLabel, parts, urgency } from '../../app/clock';
import { clockList, countdown, dueOf, proposal, setByLabel, theirClock } from '../../domain/select';
import { INK, PALETTE, urgencyAnimation } from '../../ui/tokens';
import { streamColor } from '../../ui/streams';
import styles from './Deadlines.module.css';

export function Deadlines() {
  const { state, clock, actions } = usePlanner();
  const rows = clockList(state, clock);
  const slot = proposal(clock);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Everything with a clock on it</div>
        <div className={styles.sub}>
          {state.stream
            ? `${state.stream} first, then by time remaining.`
            : 'Sorted by time remaining, not by stream.'}{' '}
          Your clock is always EAT; theirs is shown beside it in their own zone. Place-locked and
          self-driven work is not here — it has no clock.
        </div>
      </div>

      <div className={styles.table}>
        <div className={`${styles.row} ${styles.headRow}`}>
          <span>Remaining</span>
          <span>Task</span>
          <span>Stream</span>
          <span>Your clock</span>
          <span>Their clock</span>
          <span />
        </div>

        {rows.map((t) => {
          const due = dueOf(state, clock, t);
          const g = countdown(state, clock, t);
          const p = parts(due, clock.tz);
          const late = p.h >= 22 || p.h < 6;
          const missed = due.getTime() < clock.now.getTime();
          const confirmed = state.confirmed[t.id] !== undefined;

          return (
            <div
              key={t.id}
              className={styles.row}
              style={{
                background: g.hot ? 'rgba(245,64,94,.08)' : 'transparent',
                animation: urgencyAnimation(urgency(due, clock.now)),
              }}
            >
              <span
                className={`${styles.cd} tnum`}
                style={{ color: g.hot ? PALETTE.alarm : INK.primary }}
              >
                {state.settings.clockStyle === 'countdown' ? g.v : absLabel(due, clock)}
              </span>

              <span className={styles.taskCell}>
                <span className={styles.taskTitle}>{t.title}</span>
                <span className={styles.taskMeta}>
                  <span className={styles.setBy}>{setByLabel(t)}</span>
                  <button
                    type="button"
                    className={styles.confirm}
                    style={{ color: confirmed ? INK.green : 'rgba(233,240,240,.5)' }}
                    onClick={() => actions.confirmReceipt(t.id)}
                  >
                    {confirmed ? '✓ received' : 'confirm receipt'}
                  </button>
                  {missed && (
                    <button
                      type="button"
                      className={styles.take}
                      onClick={() => actions.moveTo(t.id, slot)}
                    >
                      Move to {absLabel(slot, clock)}
                    </button>
                  )}
                </span>
              </span>

              <span className={styles.streamCell}>
                <span className={styles.dot} style={{ background: streamColor(t.stream) }} />
                {t.stream}
              </span>

              <span
                className={`${styles.mine} tnum`}
                style={{ color: late ? PALETTE.workshop : 'rgba(233,240,240,.72)' }}
              >
                {absLabel(due, clock)}
                {late ? ' · after hours' : ''}
              </span>

              <span className={`${styles.theirs} tnum`}>{theirClock(state, clock, t)}</span>

              <button
                type="button"
                className={styles.remove}
                title="Delete"
                onClick={() => actions.removeTask(t.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.note}>
        Every row deletes. Capture adds. Nothing enters without a rule attached.
      </div>
    </div>
  );
}
