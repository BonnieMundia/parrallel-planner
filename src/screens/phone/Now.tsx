import { usePlanner } from '../../app/store';
import { hhmm } from '../../app/clock';
import { byRule, hero, phoneNext, quota, trip } from '../../domain/select';
import { CountdownBar } from '../../ui/primitives';
import { PALETTE, urgencyAnimation } from '../../ui/tokens';
import styles from './Screens.module.css';

export function Now() {
  const { state, clock, actions } = usePlanner();
  const card = hero(state, clock, state.aHere);
  const rows = phoneNext(state, clock, state.aHere);
  const t = trip(state, clock);
  const q = quota(state);
  const hereCount = byRule(state, 'place').filter((x) => x.place === state.aHere).length;

  const defence = {
    quota: { value: `${q.hours.toFixed(1)} / ${q.target}.0 h`, note: 'Hours only count once the work inside the block is ticked off.' },
    neglect: { value: '19 days', note: 'The bench rig has not been opened since 19 July. It has lost to a deadline six times.' },
    both: { value: `${q.hours.toFixed(1)} / ${q.target}.0 h`, note: 'Counts finished work only. Longest neglect: 19 days on the bench rig.' },
  }[state.settings.projectDefense];

  const heroColor = card.kicker === 'You are here' ? PALETTE.workshop : card.kicker === 'Nothing needs you' ? PALETTE.build : PALETTE.contract;

  return (
    <div className={styles.page}>
      <div
        className={styles.hero}
        style={{ background: card.tint, animation: urgencyAnimation(card.tier) }}
      >
        <div className={styles.heroTop}>
          <span className={styles.heroKicker} style={{ color: heroColor }}>
            {card.kicker}
          </span>
          <span className={styles.heroStream}>{card.stream}</span>
        </div>
        <div className={styles.heroTitle}>{card.title}</div>
        <div className={styles.heroBigRow}>
          <span className={`${styles.heroBig} tnum`} style={{ color: heroColor }}>
            {card.big}
          </span>
          <span className={styles.heroBigNote}>{card.bigNote}</span>
        </div>
        <div className={styles.heroWhy}>{card.why}</div>
        <div className={styles.heroActions}>
          {/* The focus overlay lands in step 8. */}
          <button type="button" className={styles.heroGo}>
            {card.cta}
          </button>
          <button
            type="button"
            className={styles.heroSkip}
            onClick={() => actions.pushBack(card.title)}
          >
            Not now
          </button>
        </div>
      </div>

      {t.on && (
        <div className={styles.tripCard}>
          <div className={styles.tripTop}>
            <span className={styles.tripLabel}>{t.label}</span>
            <span className={`${styles.tripTotal} tnum`}>{t.total}</span>
          </div>
          <div className={`${styles.tripBack} tnum`}>{t.backLabel}</div>
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
      )}

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Then</span>
          <span className={styles.sectionNote}>
            {hereCount ? 'Nearest first' : 'Desk work first'}
          </span>
        </div>
        <div className={styles.card}>
          {rows.map((r, i) => (
            <div
              key={r.id}
              className={styles.nextRow}
              style={{
                borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none',
                opacity: r.usable ? 1 : 0.42,
                animation: urgencyAnimation(r.tier),
              }}
            >
              <span className={styles.bullet} style={{ background: r.color }} />
              <span className={styles.nextText}>
                <span className={styles.nextTitle}>{r.title}</span>
                <span
                  className={styles.nextSub}
                  style={{ color: r.usable ? 'rgba(233,240,240,.55)' : 'rgba(233,240,240,.4)' }}
                >
                  {r.sub}
                </span>
              </span>
              <span
                className={`${styles.nextRight} tnum`}
                style={{ color: r.usable ? 'rgba(233,240,240,.62)' : 'rgba(233,240,240,.4)' }}
              >
                {r.right}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.defence}>
        <div className={styles.defenceHead}>
          <span className={styles.defenceLabel}>Locked to nothing</span>
          <span className={`${styles.defenceValue} tnum`}>{defence.value}</span>
        </div>
        <CountdownBar pct={q.pct} color={PALETTE.build} height={6} />
        <div className={styles.defenceNote}>{defence.note}</div>
      </div>
    </div>
  );
}
