import { usePlanner } from '../../app/store';
import { zoneClash, zoneGroups, zoneTicks } from '../../domain/select';
import styles from './Zones.module.css';

/** The screen that answers "when does their deadline actually land in my day". */
export function Zones() {
  const { state, clock } = usePlanner();
  const groups = zoneGroups(state, clock);
  const ticks = zoneTicks();
  const clash = zoneClash(state, clock);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Their clocks, laid on your day</div>
        <div className={styles.sub}>
          Every deadline sits where it actually lands in Nairobi, 06:00 to 23:00.{' '}
          {clash
            ? `${clash} ${clash === 1 ? 'deadline lands' : 'deadlines land'} outside 08:00–21:00 your time.`
            : 'Every deadline lands inside your working day.'}
        </div>
      </div>

      <div className={styles.table}>
        <div className={styles.headRow}>
          <span className={styles.headLabel}>Deadline</span>
          <span className={styles.scale}>
            {ticks.map((k) => (
              <span key={k.label} className={`${styles.tick} tnum`} style={{ left: `${k.left}%` }}>
                {k.label}
              </span>
            ))}
          </span>
          <span className={styles.headLabel}>Their clock</span>
        </div>

        {groups.map((g, i) => (
          <div key={g.city} style={{ borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none' }}>
            <div className={styles.zoneHead}>
              <span className={styles.city}>{g.city}</span>
              <span className={styles.delta}>
                {g.abbr} · {g.delta}
              </span>
            </div>

            {g.rows.map((r) => (
              <div key={r.title} className={styles.row}>
                <span className={styles.taskCell}>
                  <span className={styles.dot} style={{ background: r.color }} />
                  <span className={styles.taskTitle}>{r.title}</span>
                </span>

                <span className={styles.band}>
                  <span className={styles.bandLine} />
                  <span
                    className={`${styles.chip} tnum`}
                    style={{
                      left: `${r.left}%`,
                      transform: `translateX(${r.chipShift})`,
                      background: r.outside ? 'rgba(245,64,94,.22)' : 'rgba(255,255,255,.1)',
                      borderColor: r.outside ? 'rgba(245,64,94,.5)' : 'rgba(255,255,255,.16)',
                    }}
                  >
                    {r.mine}{' '}
                    {r.flag && <span className={styles.flag}>{r.flag}</span>}
                  </span>
                </span>

                <span className={styles.theirCell}>
                  <span className={`${styles.theirs} tnum`}>{r.theirs}</span>
                  <span className={styles.day}>{r.day}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.note}>
        The band is your day, not theirs. A deadline sitting past 21:00 means someone else’s
        afternoon is your night — the only way to move it is to ask.
      </div>
    </div>
  );
}
