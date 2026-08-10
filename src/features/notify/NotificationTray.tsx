import { usePlanner } from '../../app/store';
import styles from './NotificationTray.module.css';

const PERM_LABEL: Record<string, string> = {
  granted: 'Alerts on',
  denied: 'Blocked in browser',
  default: 'Turn on alerts',
};

export function NotificationTray() {
  const { state, actions } = usePlanner();
  if (!state.notifOpen) return null;

  const perm = state.perm;
  const label = PERM_LABEL[perm] ?? 'Turn on alerts';

  return (
    <>
      <div className={styles.dismiss} onClick={actions.closeNotif} />
      <div className={styles.tray} role="dialog" aria-modal="true" aria-label="Alerts">
        <div className={styles.head}>
          <span className={styles.title}>Alerts</span>
          <button
            type="button"
            className={styles.perm}
            style={{
              background:
                perm === 'granted'
                  ? 'rgba(53,214,160,.22)'
                  : perm === 'denied'
                    ? 'rgba(245,64,94,.2)'
                    : '#E85E42',
              color:
                perm === 'granted'
                  ? 'var(--green-ink)'
                  : perm === 'denied'
                    ? 'var(--alarm-ink-2)'
                    : '#FFFFFF',
            }}
            onClick={actions.askNotify}
          >
            {label}
          </button>
        </div>

        <div className={styles.list}>
          {state.notifs.map((n) => (
            <div key={n.id} className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.rowTitle} style={{ color: n.color }}>
                  {n.title}
                </span>
                <span className={`${styles.at} tnum`}>{n.at}</span>
              </div>
              <span className={styles.body}>{n.body}</span>
            </div>
          ))}
        </div>

        <div className={styles.foot}>
          <span className={styles.note}>
            Fires when a deadline crosses 8 h or you arrive somewhere.
          </span>
          <button type="button" className={styles.clear} onClick={actions.clearNotifs}>
            Clear
          </button>
        </div>
      </div>
    </>
  );
}
