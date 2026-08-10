import { usePlanner } from '../../app/store';
import { absLabel, parts, urgency } from '../../app/clock';
import { byRule, clockList, countdown, dueOf, theirClock } from '../../domain/select';
import { INK, PALETTE, urgencyAnimation } from '../../ui/tokens';
import { streamColor } from '../../ui/streams';
import styles from './Screens.module.css';

export function Due() {
  const { state, clock } = usePlanner();
  const rows = clockList(state, clock);

  return (
    <div className={styles.page}>
      <div className={styles.listLabel}>Clock-locked · {byRule(state, 'clock').length}</div>
      <div className={styles.card}>
        {rows.map((t, i) => {
          const due = dueOf(state, clock, t);
          const g = countdown(state, clock, t);
          const p = parts(due, clock.tz);
          const late = p.h >= 22 || p.h < 6;

          return (
            <div
              key={t.id}
              className={styles.dueRow}
              style={{
                borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none',
                animation: urgencyAnimation(urgency(due, clock.now)),
              }}
            >
              <div className={styles.dueTop}>
                <span className={styles.dueTitleWrap}>
                  <span className={styles.bullet} style={{ background: streamColor(t.stream) }} />
                  <span className={styles.dueTitle}>{t.title}</span>
                </span>
                <span
                  className={`${styles.dueCd} tnum`}
                  style={{ color: g.hot ? PALETTE.alarm : INK.primary }}
                >
                  {state.settings.clockStyle === 'countdown' ? g.v : absLabel(due, clock)}
                </span>
              </div>
              <div className={`${styles.dueFoot} tnum`}>
                <span style={{ color: late ? PALETTE.workshop : 'rgba(233,240,240,.56)' }}>
                  {absLabel(due, clock)}
                  {late ? ' · after hours' : ''}
                </span>
                <span>{theirClock(state, clock, t)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
