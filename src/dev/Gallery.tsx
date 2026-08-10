/**
 * Dev-only harness for rendering the primitives in isolation, at `#primitives`.
 * Code-split, and the route is dead outside dev. Nothing here is product copy.
 */

import { useState } from 'react';
import { Card, CountdownBar, Pill, SheetModal, Tick, Toast } from '../ui/primitives';
import { INK, PALETTE, RULE_COLOR, URGENCY_COLOR, urgencyAnimation } from '../ui/tokens';
import styles from './Gallery.module.css';

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section className={styles.row}>
      <h2 className={styles.name}>{name}</h2>
      <div className={styles.demo}>{children}</div>
    </section>
  );
}

export default function Gallery() {
  const [sheet, setSheet] = useState(false);
  const [toastOut, setToastOut] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Primitives</h1>

      <Row name="Card">
        <Card>
          <div className={styles.pad}>Frosted, radius 14, hairline border</div>
        </Card>
        <Card interactive>
          <div className={styles.pad}>Interactive — lifts 3px on hover</div>
        </Card>
        <Card tint="rgba(240,169,59,.12)" border="rgba(240,169,59,.28)">
          <div className={styles.pad}>Tinted, as the one-trip bundle</div>
        </Card>
        <Card tint="rgba(53,214,160,.14)">
          <div className={styles.pad}>Tinted green, as the defended card</div>
        </Card>
        <Card>
          <div className={styles.pad}>Row one</div>
          <div className={`${styles.pad} ${styles.sep}`}>Row two, hairline above</div>
          <div className={`${styles.pad} ${styles.sep}`}>Row three</div>
        </Card>
      </Row>

      <Row name="Pill">
        <Pill dot={PALETTE.build} background="rgba(53,214,160,.16)" color={INK.green}>
          Home desk
        </Pill>
        <Pill dot={PALETTE.life} background="rgba(79,209,197,.2)" color={INK.teal}>
          Weekly
        </Pill>
        <Pill background="rgba(255,122,92,.22)" color={INK.link}>
          Contract
        </Pill>
        <Pill dot={PALETTE.workshop} onClick={() => undefined} title="Clickable">
          Button variant
        </Pill>
      </Row>

      <Row name="Tick">
        {['a', 'b', 'c'].map((id) => (
          <span key={id} className={styles.tickCell}>
            <Tick
              label="Mark done"
              onClick={() => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))}
            />
            <span className={ticked.includes(id) ? styles.struck : undefined}>Task {id}</span>
          </span>
        ))}
      </Row>

      <Row name="CountdownBar">
        <div className={styles.bars}>
          {([0, 1, 2, 3] as const).map((tier) => (
            <div key={tier} className={styles.bar}>
              <span className={styles.barLabel}>tier {tier}</span>
              <CountdownBar pct={[86, 61, 38, 12][tier] ?? 0} color={URGENCY_COLOR[tier]} />
            </div>
          ))}
          <div className={styles.bar}>
            <span className={styles.barLabel}>6px quota</span>
            <CountdownBar pct={58} color={PALETTE.build} height={6} label="Defended this week" />
          </div>
          <div className={styles.bar}>
            <span className={styles.barLabel}>clamped 140</span>
            <CountdownBar pct={140} color={PALETTE.build} />
          </div>
        </div>
      </Row>

      <Row name="Urgency animation">
        <div className={styles.bars}>
          {([1, 2, 3] as const).map((tier) => (
            <Card key={tier}>
              <div className={styles.pad} style={{ animation: urgencyAnimation(tier) }}>
                tier {tier}
              </div>
            </Card>
          ))}
        </div>
      </Row>

      <Row name="Rule colours">
        {(['clock', 'place', 'none'] as const).map((rule) => (
          <span key={rule} className={styles.swatchCell}>
            <span className={styles.swatch} style={{ background: RULE_COLOR[rule] }} />
            {rule}
          </span>
        ))}
      </Row>

      <Row name="SheetModal">
        <button type="button" className={styles.cta} onClick={() => setSheet(true)}>
          Open sheet
        </button>
        <div className={styles.stage}>
          <SheetModal open={sheet} title="Where are you" onClose={() => setSheet(false)}>
            <div>Escape or the scrim closes it.</div>
            <div>Focus returns to the button that opened it.</div>
          </SheetModal>
        </div>
      </Row>

      <Row name="Toast">
        <button type="button" className={styles.cta} onClick={() => setToastOut((v) => !v)}>
          {toastOut ? 'Play in' : 'Play out'}
        </button>
        <div className={styles.stage}>
          <Toast title="Done" sub="RLHF batch #4118 — 40 tasks" color={PALETTE.build} out={toastOut} />
        </div>
        <div className={`${styles.stage} ${styles.phoneStage}`}>
          <Toast
            title="Skipped once"
            sub="Sunday service will not run this Sun. It comes back next week."
            color={PALETTE.workshop}
            placement="phone"
            out={toastOut}
          />
        </div>
      </Row>
    </div>
  );
}
