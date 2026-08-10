import { usePlanner } from '../../app/store';
import { MONTHS, parts } from '../../app/clock';
import { byRule, placeGroups } from '../../domain/select';
import type { Stream } from '../../domain/types';
import { streamColor } from '../../ui/streams';
import { fadeUpDelayed } from '../../ui/tokens';
import { ClockColumn } from './today/ClockColumn';
import { PlaceColumn } from './today/PlaceColumn';
import { NoneColumn } from './today/NoneColumn';
import { Rail } from './Rail';
import styles from './Today.module.css';

/** The committed bar is authored, not derived — the prototype hard-codes both. */
const COMMITTED_LABEL = '9.5 of 15 h';
const COMMITTED_SEGMENTS: readonly (readonly [Stream, number])[] = [
  ['Contract', 29],
  ['Writing', 15],
  ['Life & errands', 11],
  ['Personal builds', 8],
];

export function Today() {
  const { state, clock } = usePlanner();
  const p = parts(clock.now, clock.tz);
  const hour = p.h;
  const hello = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${state.settings.userName}`;

  const nClock = byRule(state, 'clock').length;
  const nPlace = byRule(state, 'place').length;
  const hereCount = byRule(state, 'place').filter((t) => t.place === state.here).length;
  const nPlaces = placeGroups(state, clock).length;

  return (
    <div className={styles.today}>
      <div className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.eyebrow}>{hello}</div>
            <div className={styles.date}>
              {p.dow} {p.d} {MONTHS[p.mo - 1]}
            </div>
            <div className={styles.summary}>
              {nClock} clock-locked · <span className={styles.late}>1 lands after your last block</span>{' '}
              · {hereCount} live where you are · {nPlace} waiting across {nPlaces} places
            </div>
          </div>

          <div className={styles.committed}>
            <div className={styles.committedHead}>
              <span>Committed</span>
              <span className={`${styles.committedValue} tnum`}>{COMMITTED_LABEL}</span>
            </div>
            <div className={styles.committedBar}>
              {COMMITTED_SEGMENTS.map(([stream, w]) => (
                <div key={stream} style={{ width: `${w}%`, background: streamColor(stream) }} />
              ))}
            </div>
          </div>
        </div>

        {/* The three columns enter staggered, so the tab arrives rather than appearing. */}
        <div className={styles.columns}>
          <div style={{ animation: fadeUpDelayed(0), minWidth: 0 }}>
            <ClockColumn />
          </div>
          <div style={{ animation: fadeUpDelayed(1), minWidth: 0 }}>
            <PlaceColumn />
          </div>
          <div style={{ animation: fadeUpDelayed(2), minWidth: 0 }}>
            <NoneColumn />
          </div>
        </div>
      </div>

      <Rail />
    </div>
  );
}
