import { usePlanner } from '../../../app/store';
import { DOW, hhmm } from '../../../app/clock';
import { byRule, findTask, placeGroups, trip } from '../../../domain/select';
import { isPlaceTask } from '../../../domain/types';
import { Tick } from '../../../ui/primitives';
import { INK, PALETTE } from '../../../ui/tokens';
import { streamFade } from '../../../ui/streams';
import { DoneCollapsible } from './DoneCollapsible';
import styles from './Columns.module.css';

export function PlaceColumn() {
  const { state, clock, actions } = usePlanner();
  const groups = placeGroups(state, clock);
  const t = trip(state, clock);
  const endedIds = Object.keys(state.ended);
  const skipCount = Object.values(state.skips).reduce((a, x) => a + x.length, 0);

  return (
    <div className={styles.column}>
      <div className={styles.head}>
        <span className={styles.dot} style={{ background: PALETTE.workshop }} />
        <span className={styles.headName}>Locked to a place</span>
        <span className={styles.headCount}>{byRule(state, 'place').length}</span>
      </div>

      {t.on && (
        <div className={styles.trip}>
          <div className={styles.tripHead}>
            <span className={styles.tripLabel}>{t.label}</span>
            <span className={`${styles.tripTotal} tnum`}>{t.total}</span>
          </div>
          {t.stops.map((s) => (
            <div key={s.place.id} className={styles.tripStop}>
              <span className={styles.tripStopName}>{s.place.name}</span>
              <span className={`${styles.tripStopLine} tnum`}>{s.line}</span>
            </div>
          ))}
          <div className={styles.tripFoot}>
            <span className={`${styles.tripBack} tnum`}>{t.backLabel}</span>
            <button
              type="button"
              className={styles.tripPlan}
              onClick={() =>
                actions.planTrip(
                  t.stops.map((s) => s.place.name),
                  hhmm(t.back, clock.tz),
                )
              }
            >
              Plan the trip
            </button>
          </div>
        </div>
      )}

      {groups.map((g) => (
        <div
          key={g.place.id}
          className={styles.group}
          style={{
            opacity: g.dim ? 0.5 : 1,
            background: g.here ? 'rgba(23,31,35,.62)' : 'rgba(23,31,35,.42)',
            border: `1px solid ${g.here ? 'rgba(53,214,160,.28)' : 'rgba(255,255,255,.07)'}`,
          }}
        >
          <div
            className={styles.groupHead}
            style={{ background: g.here ? 'rgba(53,214,160,.16)' : 'rgba(110,128,132,.14)' }}
          >
            <span className={styles.rowTitleWrap}>
              <span
                className={styles.groupDot}
                style={{ background: g.here ? PALETTE.build : PALETTE.workshop }}
              />
              <span
                className={styles.groupName}
                style={{ color: g.here ? INK.green : 'rgba(233,240,240,.72)' }}
              >
                {g.place.name}
              </span>
            </span>
            <span className={styles.groupStatus}>{g.status}</span>
          </div>

          {g.items.map((item) => {
            const untilColor = item.label.hot
              ? PALETTE.alarm
              : item.label.at === 'No set time'
                ? INK.primary
                : INK.primary;
            return (
              <div
                key={item.task.id}
                className={styles.placeRow}
                style={{ opacity: streamFade(state.stream, item.task.stream) }}
              >
                <Tick label="Mark done" onClick={() => actions.completeTask(item.task.id)} />
                <span className={styles.placeBody}>
                  <span className={styles.placeTitle}>{item.task.title}</span>
                  <span className={styles.whenRow}>
                    <span
                      className={`${styles.whenAt} tnum`}
                      style={{
                        color: item.label.at === 'No set time' ? INK.primary : untilColor,
                        opacity: item.label.at === 'No set time' ? 0.5 : 1,
                      }}
                    >
                      {item.label.at}
                    </span>
                    <span
                      className={`${styles.whenIn} tnum`}
                      style={{
                        color: item.label.at === 'No set time' ? INK.primary : untilColor,
                        opacity: item.label.at === 'No set time' ? 0.5 : 0.8,
                      }}
                    >
                      {item.label.in}
                    </span>
                  </span>
                  <span className={styles.placeMeta}>{item.meta}</span>
                  {item.leave && (
                    <span
                      className={`${styles.leaveBy} tnum`}
                      style={{
                        color: item.leave.urgent ? PALETTE.workshop : 'rgba(233,240,240,.6)',
                      }}
                    >
                      <span className={styles.leaveDot} />
                      {item.leave.label}
                    </span>
                  )}
                  {item.recurring && item.task.dow !== undefined && (
                    <span className={styles.repeat}>
                      <span className={styles.weekly}>Every {DOW[item.task.dow]}</span>
                      <button
                        type="button"
                        className={styles.repeatBtn}
                        onClick={() => actions.skipOnce(item.task.id)}
                      >
                        Skip this week
                      </button>
                      <button
                        type="button"
                        className={`${styles.repeatBtn} ${styles.endBtn}`}
                        onClick={() => actions.endSeries(item.task.id)}
                      >
                        End series
                      </button>
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className={styles.remove}
                  title="Delete"
                  onClick={() => actions.removeTask(item.task.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {endedIds.length > 0 && (
        <div className={styles.ended}>
          <div className={styles.endedHead}>
            Ended series ·{' '}
            {skipCount
              ? `${skipCount} ${skipCount === 1 ? 'occurrence' : 'occurrences'} skipped`
              : 'Nothing skipped'}
          </div>
          {endedIds.map((id) => {
            const task = findTask(state, id);
            const when =
              task && isPlaceTask(task) && task.dow !== undefined
                ? `was every ${DOW[task.dow]}`
                : 'was repeating';
            return (
              <div key={id} className={styles.endedRow}>
                <span className={styles.endedBody}>
                  <span className={styles.endedTitle}>{task?.title ?? id}</span>
                  <span className={styles.endedWhen}>{when}</span>
                </span>
                <button
                  type="button"
                  className={styles.resume}
                  onClick={() => actions.resumeSeries(id)}
                >
                  Resume
                </button>
              </div>
            );
          })}
        </div>
      )}

      <DoneCollapsible rule="place" doneKey="place" />

      <div className={styles.note}>
        Soonest first, across every place. Only the one you are standing in is live.
      </div>
    </div>
  );
}
