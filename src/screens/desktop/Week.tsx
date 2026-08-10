import { usePlanner } from '../../app/store';
import { MONTHS, padHour } from '../../app/clock';
import {
  blockGivenAway,
  findTask,
  monday,
  reviewRows,
  streak,
  weekDays,
  weekNumber,
  weekRange,
} from '../../domain/select';
import { SEED_STREAMS } from '../../domain/seed';
import { streamChipBg, streamColor } from '../../ui/streams';
import { laneStyle, packLanes } from '../../ui/dayLayout';
import { INK } from '../../ui/tokens';
import { SurrenderSheet } from './SurrenderSheet';
import styles from './Week.module.css';

/** The compressed grid: 06–22, 26 px an hour, labelled every two hours. */
const DAY_START = 6;
const SCALE = 26;

const HATCH = 'repeating-linear-gradient(135deg,rgba(53,214,160,.2) 0 6px,transparent 6px 12px)';

export function Week() {
  const { state, clock, actions } = usePlanner();
  const mon = monday(state, clock);
  const days = weekDays(state, clock);
  const rows = reviewRows(state, clock);
  const run = streak(state, clock);
  const off = state.wk;

  const hours = [];
  for (let h = DAY_START; h <= 22; h += 2) {
    hours.push({ label: String(h).padStart(2, '0'), top: (h - DAY_START) * SCALE });
  }

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
    <div className={styles.week}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.titleRow}>
            <div className={styles.title}>Week {weekNumber(mon)}</div>
            <div className={styles.nav}>
              <button
                type="button"
                className={styles.navBtn}
                title="Previous week"
                onClick={() => actions.stepWeek(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.navNow}
                style={{
                  color: off === 0 ? INK.link : off < 0 ? 'rgba(233,240,240,.5)' : INK.amber,
                }}
                onClick={() => actions.setWeek(0)}
              >
                {rel}
              </button>
              <button
                type="button"
                className={styles.navBtn}
                title="Next week"
                onClick={() => actions.stepWeek(1)}
              >
                ›
              </button>
            </div>
          </div>
          <div className={styles.sub}>
            {weekRange(mon, MONTHS)}.{' '}
            {off === 0
              ? 'Hatched blocks are defended; giving one away asks what you are giving it to.'
              : 'Standing commitments repeat here. One-off deadlines only appear in the week they fall in.'}
          </div>
        </div>

        <div className={styles.legend}>
          {SEED_STREAMS.map((s) => (
            <span key={s.name} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: s.color }} />
              {s.name === 'Personal builds' ? 'Builds' : s.name}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.gutter}>
          <div className={styles.dayHead} />
          <div className={styles.gutterTrack}>
            {hours.map((h) => (
              <span key={h.label} className={`${styles.gutterHour} tnum`} style={{ top: h.top }}>
                {h.label}
              </span>
            ))}
          </div>
        </div>

        {days.map((day) => {
          const laid = packLanes(
            day.blocks.map((b) => {
              const task = b.t !== null ? findTask(state, b.t) : null;
              const box = (b.e - b.s) * SCALE - 3;
              const gone = blockGivenAway(state, `blk:${b.d}:${b.s}`);
              const finished = b.t !== null && state.done[b.t] !== undefined;
              return {
                key: `${b.t ?? 'free'}:${b.d}:${b.s}`,
                top: (b.s - DAY_START) * SCALE,
                h: box,
                tier: box >= 46 ? 0 : box >= 28 ? 1 : 2,
                title:
                  (finished ? '✓ ' : gone ? 'Given away — ' : '') +
                  (b.label ?? task?.short ?? 'Unclaimed'),
                defended: !task || task.rule === 'none',
                gone,
                finished,
                bg: gone
                  ? 'rgba(110,128,132,.18)'
                  : finished
                    ? 'rgba(53,214,160,.1)'
                    : task
                      ? streamChipBg(task.stream)
                      : 'rgba(53,214,160,.1)',
                surrender: {
                  key: `blk:${b.d}:${b.s}`,
                  taskId: b.t,
                  title: b.label ?? task?.short ?? 'Unclaimed',
                  when: `${padHour(b.s)} – ${padHour(b.e)}`,
                },
              };
            }),
          );

          return (
            <div
              key={day.dow}
              className={styles.day}
              style={{ background: day.isToday ? 'rgba(110,128,132,.16)' : 'transparent' }}
            >
              <div className={styles.dayHead}>
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
              </div>

              <div className={styles.dayTrack}>
                {laid.map((b) => {
                  const pos = laneStyle(b, 4, 8);
                  const canGive = b.defended && !b.gone;
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
                        backgroundColor: b.bg,
                        backgroundImage: canGive && !b.finished ? HATCH : 'none',
                        cursor: canGive ? 'pointer' : 'default',
                      }}
                      onClick={canGive ? () => actions.openSurrender(b.surrender) : undefined}
                    >
                      <span
                        className={styles.blockTitle}
                        style={{
                          font: b.tier === 2 ? '590 9.5px/1.1 var(--font)' : undefined,
                          color: b.gone || b.finished ? 'rgba(233,240,240,.6)' : undefined,
                        }}
                      >
                        {b.title}
                      </span>
                    </div>
                  );
                })}

                {day.marks.map((m) => (
                  <div
                    key={`${m.stream}:${m.at}`}
                    className={styles.mark}
                    style={{
                      top: (m.at - DAY_START) * SCALE,
                      borderTopColor: streamColor(m.stream),
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.review}>
        <div className={styles.streak}>
          <span className={styles.streakLabel}>
            {run ? `${run} ${run === 1 ? 'day' : 'days'} in a row` : 'No streak yet'}
          </span>
          <span className={styles.streakNote}>
            {run
              ? 'Counted from the last thing you ticked off.'
              : 'Tick something off today to start one.'}
          </span>
        </div>

        <div className={styles.reviewGrid}>
          {rows.map((r) => (
            <div key={r.name} className={styles.reviewCard} style={{ opacity: r.dim }}>
              <span className={styles.reviewHead}>
                <span className={styles.reviewDot} style={{ background: r.color }} />
                <span className={styles.reviewName}>{r.name}</span>
              </span>
              <span className={styles.reviewTrack}>
                <span
                  className={styles.reviewFill}
                  style={{ width: `${r.keptPct}%`, background: r.color }}
                />
              </span>
              <span className={`${styles.reviewLine} tnum`}>{r.blocks}</span>
              <span className={`${styles.reviewLineQuiet} tnum`}>{r.done}</span>
            </div>
          ))}
        </div>
      </div>

      <SurrenderSheet />
    </div>
  );
}
