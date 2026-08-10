import { usePlanner } from '../../app/store';
import { hhmm, padHour, parts } from '../../app/clock';
import { dueOf, findTask, todayBlocks } from '../../domain/select';
import { streamColor, streamChipBg } from '../../ui/streams';
import { laneStyle, packLanes } from '../../ui/dayLayout';
import styles from './Rail.module.css';

/** 06–23, 35 px an hour. */
const DAY_START = 6;
const SCALE = 35;
const TRACK = 595;

const HATCH = 'repeating-linear-gradient(135deg,rgba(53,214,160,.2) 0 6px,transparent 6px 12px)';

export function Rail() {
  const { state, clock } = usePlanner();

  const hours = [];
  for (let h = DAY_START; h <= 23; h++) hours.push({ label: String(h).padStart(2, '0'), h });

  const laid = packLanes(
    todayBlocks(state, clock).map((b) => {
      const task = b.t !== null ? findTask(state, b.t) : null;
      const box = (b.e - b.s) * SCALE - 4;
      return {
        key: `${b.t ?? 'free'}:${b.d}:${b.s}`,
        top: (b.s - DAY_START) * SCALE,
        h: box,
        // Chrome and type step down so short blocks still read.
        tier: box >= 46 ? 0 : box >= 28 ? 1 : 2,
        title:
          (b.t !== null && state.done[b.t] !== undefined ? '✓ ' : '') +
          (b.label ?? task?.short ?? 'Unclaimed'),
        time: `${padHour(b.s)} – ${padHour(b.e)}`,
        finished: b.t !== null && state.done[b.t] !== undefined,
        // A block with no task, or one on a task locked to nothing, is defended.
        defended: !task || task.rule === 'none',
        color: task ? streamColor(task.stream) : streamColor('Personal builds'),
        bg: task ? streamChipBg(task.stream) : 'rgba(53,214,160,.1)',
      };
    }),
  );

  const np = parts(clock.now, clock.tz);
  const nowTop = Math.min(TRACK, Math.max(0, (np.h + np.mi / 60 - DAY_START) * SCALE));

  const sleeper = todayBlocks(state, clock).length > 0 ? findTask(state, 'rlhf') : null;
  const lateAt = sleeper ? hhmm(dueOf(state, clock, sleeper), clock.tz) : '';

  return (
    <div className={styles.rail}>
      <div className={styles.head}>
        <span className={styles.title}>Today, laid out</span>
        <span className={styles.range}>06–23</span>
      </div>

      <div className={styles.scroller}>
        <div className={styles.track} style={{ height: TRACK }}>
          {hours.map((h) => (
            <div key={h.h} className={styles.hour} style={{ top: (h.h - DAY_START) * SCALE }}>
              <span className={`${styles.hourLabel} tnum`}>{h.label}</span>
              <span className={styles.rule} />
            </div>
          ))}

          {laid.map((b) => {
            const pos = laneStyle(b, 36, 36);
            return (
              <div
                key={b.key}
                className={styles.block}
                style={{
                  top: b.top,
                  height: b.h,
                  left: pos.left,
                  width: pos.width,
                  padding: ['6px 9px', '4px 9px', '2px 8px'][b.tier],
                  // Never the `background` shorthand beside backgroundImage — React
                  // warns, and the two fight on rerender.
                  backgroundColor: b.finished ? 'rgba(53,214,160,.1)' : b.bg,
                  backgroundImage: b.defended && !b.finished ? HATCH : 'none',
                  opacity: b.finished ? 0.55 : 1,
                }}
              >
                <span
                  className={styles.blockTitle}
                  style={{ font: b.tier === 2 ? '590 11px/1.1 var(--font)' : undefined }}
                >
                  {b.title}
                </span>
                {b.tier === 0 && (
                  <span
                    className={`${styles.blockTime} tnum`}
                    style={{ color: b.finished ? 'rgba(233,240,240,.6)' : b.color }}
                  >
                    {b.time}
                  </span>
                )}
              </div>
            );
          })}

          <div className={styles.now} style={{ top: nowTop }}>
            <span className={styles.nowDot} />
            <span className={styles.nowLine} />
          </div>
        </div>

        {sleeper && (
          <div className={styles.late}>
            <span className={styles.lateHead}>One deadline lands after you stop</span>
            <span className={styles.lateNote}>
              RLHF batch #4118 closes at {lateAt} EAT. Your last block ends at 21:00, so it either
              moves earlier or it is a late night.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
