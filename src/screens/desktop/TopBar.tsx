import { usePlanner } from '../../app/store';
import type { Tab } from '../../domain/state';
import { placeName } from '../../domain/select';
import { hhmm } from '../../app/clock';
import styles from './TopBar.module.css';

const TABS: readonly (readonly [Tab, string])[] = [
  ['today', 'Today'],
  ['week', 'Week'],
  ['due', 'Deadlines'],
  ['zones', 'Zones'],
];

export function TopBar() {
  const { state, clock, actions } = usePlanner();
  const here = placeName(state, state.here);

  return (
    <div className={styles.bar}>
      <div className={styles.tabs} role="tablist" aria-label="View">
        {TABS.map(([key, label]) => {
          const on = state.tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              className={`${styles.tab} ${on ? styles.tabOn : ''}`}
              onClick={() => actions.setTab(key)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className={styles.right}>
        <span className={styles.placePill}>
          <span className={styles.placeDot} />
          {here}
        </span>
        <span className={`${styles.clock} tnum`}>
          Nairobi <span className={styles.clockTime}>{hhmm(clock.now, clock.tz)}</span>
        </span>
        <button
          type="button"
          className={styles.bell}
          title="Notifications"
          onClick={actions.toggleNotif}
        >
          <span aria-hidden="true">◔</span>
          {state.notifs.length > 0 && (
            <span className={`${styles.badge} tnum`}>{state.notifs.length}</span>
          )}
        </button>
        <button type="button" className={styles.capture} onClick={actions.openCapture}>
          + Capture
        </button>
      </div>
    </div>
  );
}
