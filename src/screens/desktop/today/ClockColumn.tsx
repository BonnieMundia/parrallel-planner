import { usePlanner } from '../../../app/store';
import { absLabel, hhmm, urgency, zoneAbbr } from '../../../app/clock';
import {
  clockList,
  countdown,
  dueOf,
  proposal,
  setByLabel,
  theirCity,
  theirClock,
} from '../../../domain/select';
import type { ClockTask } from '../../../domain/types';
import { Card, CountdownBar, Tick } from '../../../ui/primitives';
import { INK, PALETTE, urgencyAnimation } from '../../../ui/tokens';
import { streamColor, streamFade } from '../../../ui/streams';
import { DoneCollapsible } from './DoneCollapsible';
import styles from './Columns.module.css';

export function ClockColumn() {
  const { state, clock, actions } = usePlanner();
  const all = clockList(state, clock);
  const rows = all.slice(0, 4);

  const hot = all.find((t) => t.sleep) ?? all[0];
  const sleepWarn = hot
    ? `Lands at ${hhmm(dueOf(state, clock, hot), clock.tz)}, after your last block ends at 21:00.`
    : '';

  return (
    <div className={styles.column}>
      <div className={styles.head}>
        <span className={styles.dot} style={{ background: PALETTE.contract }} />
        <span className={styles.headName}>Locked to a clock</span>
        <span className={styles.headCount}>{all.length}</span>
      </div>

      <Card interactive>
        {rows.map((t, i) => (
          <ClockRow key={t.id} task={t} first={i === 0} sleepWarn={sleepWarn} />
        ))}
      </Card>

      <DoneCollapsible rule="clock" doneKey="clock" />

      <div className={styles.note}>
        Someone else set the time, in their zone. Every clock here is EAT. Click one for the
        detail.
      </div>
    </div>
  );

  function ClockRow({
    task,
    first,
    sleepWarn: warn,
  }: {
    task: ClockTask;
    first: boolean;
    sleepWarn: string;
  }) {
    const due = dueOf(state, clock, task);
    const g = countdown(state, clock, task);
    const tier = urgency(due, clock.now);
    const open = state.sel === task.id;
    const missed = due.getTime() < clock.now.getTime();
    const cdColor = g.hot ? PALETTE.alarm : INK.primary;
    const slot = proposal(clock);

    return (
      <div
        className={`${styles.row} ${open ? styles.rowOpen : ''}`}
        style={{
          borderTop: first ? 'none' : '1px solid rgba(255,255,255,.08)',
          opacity: streamFade(state.stream, task.stream),
          animation: urgencyAnimation(tier),
        }}
        onClick={() => actions.select(open ? null : task.id)}
      >
        <div className={styles.rowTop}>
          <span className={styles.rowTitleWrap}>
            <span onClick={(e) => e.stopPropagation()}>
              <Tick label="Mark done" onClick={() => actions.completeTask(task.id)} />
            </span>
            <span className={styles.title}>{task.title}</span>
          </span>
          <span className={styles.rowTools}>
            <span className={styles.dot} style={{ background: streamColor(task.stream) }} />
            <button
              type="button"
              className={styles.remove}
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                actions.removeTask(task.id);
              }}
            >
              ×
            </button>
          </span>
        </div>

        <div className={styles.countRow}>
          <span className={`${styles.count} tnum`} style={{ color: cdColor }}>
            {state.settings.clockStyle === 'countdown' ? g.v : absLabel(due, clock)}
          </span>
          <span className={styles.countUnit}>
            {state.settings.clockStyle === 'countdown' ? g.u : theirClock(state, clock, task)}
          </span>
        </div>

        <CountdownBar pct={task.pct ?? 0} color={cdColor} />

        <div className={`${styles.foot} tnum`}>
          <span>{absLabel(due, clock)} EAT</span>
          <span className={styles.footRight}>{theirClock(state, clock, task)}</span>
        </div>

        {task.sleep === true && (
          <div className={styles.sleep}>
            <span className={styles.blinkDot} />
            {warn}
          </div>
        )}

        {open && (
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.notes}>{task.notes ?? task.note}</div>
            <div className={styles.grid}>
              <span className={styles.cell}>
                <span className={styles.cellLabel}>Their clock</span>
                <span className={`${styles.cellValue} tnum`}>
                  {task.tz !== undefined
                    ? `${hhmm(due, task.tz)} ${zoneAbbr(task.tz, due)}`
                    : '—'}
                </span>
                <span className={styles.cellNote}>{theirCity(task)}</span>
              </span>
              <span className={styles.cell}>
                <span className={styles.cellLabel}>Your clock</span>
                <span className={`${styles.cellValue} tnum`} style={{ color: cdColor }}>
                  {absLabel(due, clock)} EAT
                </span>
                <span className={styles.cellNote}>Nairobi</span>
              </span>
              <span className={styles.cell}>
                <span className={styles.cellLabel}>Stream</span>
                <span className={styles.cellValue}>{task.stream}</span>
                <span className={styles.cellNote}>{task.pct ?? 0}% done</span>
              </span>
              <span className={styles.cell}>
                <span className={styles.cellLabel}>If it slips</span>
                <span className={styles.cellValue}>{task.note ?? '—'}</span>
              </span>
            </div>

            <div className={styles.panelActions}>
              <span className={styles.setBy}>{setByLabel(task)}</span>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => actions.confirmReceipt(task.id)}
              >
                {state.confirmed[task.id] !== undefined
                  ? `Receipt confirmed ${hhmm(new Date(state.confirmed[task.id] ?? 0), clock.tz)}`
                  : 'Confirm you received this'}
              </button>
              <button
                type="button"
                className={styles.focus}
                onClick={() => actions.startFocus(task.id, 90)}
              >
                Focus 90 min
              </button>
            </div>

            {missed && (
              <div className={styles.missed}>
                <span className={styles.missedText}>
                  Its time has passed. It will not move on its own.
                </span>
                <span className={styles.missedButtons}>
                  <button
                    type="button"
                    className={styles.take}
                    onClick={() => actions.moveTo(task.id, slot)}
                  >
                    Move to {absLabel(slot, clock)}
                  </button>
                  <button
                    type="button"
                    className={styles.leave}
                    onClick={() => actions.keepInPlace(task.id)}
                  >
                    Leave it
                  </button>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
