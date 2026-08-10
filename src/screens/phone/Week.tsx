import { usePlanner } from '../../app/store';
import { MONTHS } from '../../app/clock';
import { findTask, monday, weekDays, weekNumber, weekRange } from '../../domain/select';
import { streamChipBg } from '../../ui/streams';
import { INK } from '../../ui/tokens';
import styles from './Screens.module.css';

const HATCH = 'repeating-linear-gradient(135deg,rgba(53,214,160,.2) 0 6px,transparent 6px 12px)';

/** The week compressed to one row a day — chips, not a grid. */
export function Week() {
  const { state, clock, actions } = usePlanner();
  const mon = monday(state, clock);
  const days = weekDays(state, clock);
  const off = state.wk;

  const rel =
    off === 0
      ? 'This week'
      : off === -1
        ? 'Last week'
        : off === 1
          ? 'Next week'
          : off < 0
            ? `${Math.abs(off)} weeks back`
            : `${off} weeks ahead`;

  return (
    <div className={styles.page}>
      <div className={styles.weekHead}>
        <span className={styles.weekLabel}>
          Week {weekNumber(mon)} · {weekRange(mon, MONTHS)}
        </span>
        <span className={styles.weekNav}>
          <button
            type="button"
            className={styles.weekBtn}
            title="Previous week"
            onClick={() => actions.stepWeek(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.weekNow}
            style={{ color: off === 0 ? INK.link : off < 0 ? 'rgba(233,240,240,.5)' : INK.amber }}
            onClick={() => actions.setWeek(0)}
          >
            {rel}
          </button>
          <button
            type="button"
            className={styles.weekBtn}
            title="Next week"
            onClick={() => actions.stepWeek(1)}
          >
            ›
          </button>
        </span>
      </div>

      <div className={styles.card}>
        {days.map((day, i) => (
          <div
            key={day.dow}
            className={styles.dayRow}
            style={{
              borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none',
              background: day.isToday ? 'rgba(110,128,132,.16)' : 'transparent',
            }}
          >
            <span className={styles.dayCell}>
              <span
                className={styles.dayName}
                style={{ color: day.isToday ? INK.link : 'rgba(233,240,240,.6)' }}
              >
                {day.dow}
              </span>
              <span
                className={`${styles.dayNum} tnum`}
                style={{ background: day.isToday ? '#FF7A5C' : 'transparent' }}
              >
                {day.num}
              </span>
            </span>

            <span className={styles.chips}>
              {day.blocks.map((b) => {
                const task = b.t !== null ? findTask(state, b.t) : null;
                const gone = state.losses[`blk:${b.d}:${b.s}`] !== undefined;
                const finished = b.t !== null && state.done[b.t] !== undefined;
                const defended = !task || task.rule === 'none';
                return (
                  <span
                    key={`${b.t ?? 'free'}:${b.s}`}
                    className={styles.chip}
                    style={{
                      backgroundColor: gone
                        ? 'rgba(110,128,132,.18)'
                        : finished
                          ? 'rgba(53,214,160,.1)'
                          : task
                            ? streamChipBg(task.stream)
                            : 'rgba(53,214,160,.1)',
                      backgroundImage: defended && !gone && !finished ? HATCH : 'none',
                    }}
                  >
                    {(finished ? '✓ ' : gone ? 'Given away — ' : '') +
                      (b.label ?? task?.short ?? 'Unclaimed')}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
