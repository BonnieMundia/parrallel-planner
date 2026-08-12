import { usePlanner } from '../../app/store';
import { absLabel, gap } from '../../app/clock';
import { activeLabel, clockByDue, byRule, dueOf, placeName, soonest } from '../../domain/select';
import type { Task } from '../../domain/types';
import { PALETTE } from '../../ui/tokens';
import { streamColor } from '../../ui/streams';
import styles from './Greeting.module.css';

/**
 * A welcome that shows what is coming, then gets out of the way. Holds for 3.2s,
 * leaves by 3.7s, and a tap skips it — nobody should have to wait for a splash.
 */
export function Greeting() {
  const { state, clock, actions } = usePlanner();
  if (!state.greet) return null;

  const byDue = clockByDue(state, clock);
  const byPlace = [...byRule(state, 'place')].sort(
    (a, b) => soonest(state, clock, a) - soonest(state, clock, b),
  );

  const items: Task[] = [...byDue.slice(0, 2), ...byPlace.slice(0, 2)].slice(0, 3);
  const hot = byDue.filter((t) => gap(dueOf(state, clock, t), clock.now).hot).length;

  const line =
    'Here are your upcoming tasks. ' +
    (hot
      ? `${hot} ${hot === 1 ? 'deadline is' : 'deadlines are'} inside eight hours.`
      : 'Nothing is inside eight hours yet.');

  return (
    <div
      className={styles.overlay}
      style={{ animation: state.greet === 'out' ? 'ppFadeOut .48s ease forwards' : 'ppFadeOut .38s ease reverse both' }}
      onClick={actions.skipGreeting}
      role="button"
      tabIndex={0}
      aria-label="Dismiss welcome"
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && actions.skipGreeting()}
    >
      <div className={styles.head}>
        <span className={styles.kicker}>Welcome back</span>
        <span className={styles.name}>{state.settings.userName}</span>
        <span className={styles.line}>{line}</span>
      </div>

      <div className={styles.items}>
        {items.map((t, i) => {
          const isPlace = t.rule === 'place';
          const label = isPlace ? activeLabel(state, clock, t) : null;
          const g = isPlace ? null : gap(dueOf(state, clock, t), clock.now);
          return (
            <div
              key={t.id}
              className={styles.item}
              style={{ animation: `ppFadeUp .55s ${(0.38 + i * 0.12).toFixed(2)}s cubic-bezier(.2,.8,.3,1) both` }}
            >
              <span className={styles.dot} style={{ background: streamColor(t.stream) }} />
              <span className={styles.itemText}>
                <span className={styles.itemTitle}>{t.title}</span>
                <span className={styles.itemSub}>
                  {isPlace && label
                    ? `${placeName(state, t.place)} · ${label.at}`
                    : absLabel(dueOf(state, clock, t), clock)}
                </span>
              </span>
              <span
                className={`${styles.itemRight} tnum`}
                style={{ color: g?.hot ? PALETTE.alarm : 'rgba(233,240,240,.62)' }}
              >
                {isPlace && label
                  ? label.at === 'No set time'
                    ? (t.est ?? '~30m')
                    : label.in.replace(' from now', '')
                  : (g?.v ?? '')}
              </span>
            </div>
          );
        })}
      </div>

      <span className={styles.skip}>Tap anywhere to continue</span>
    </div>
  );
}
