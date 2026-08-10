import { usePlanner } from '../../app/store';
import { DOW, hhmm, nextInZone, zoneCity } from '../../app/clock';
import { SEED_STREAMS, SEED_ZONES } from '../../domain/seed';
import { absLabel } from '../../app/clock';
import { places } from '../../domain/select';
import type { Dow, Rule } from '../../domain/types';
import { PALETTE } from '../../ui/tokens';
import { ANIM } from '../../ui/tokens';
import styles from './CaptureSheet.module.css';

const RULES: readonly { key: Rule; label: string; sub: string; color: string }[] = [
  { key: 'clock', label: 'A clock', sub: 'Someone else set the date', color: PALETTE.contract },
  { key: 'place', label: 'A place', sub: 'Only happens somewhere', color: PALETTE.workshop },
  { key: 'none', label: 'Nothing', sub: 'Needs defending', color: PALETTE.build },
];

const REPEATS: readonly { key: 'once' | 'today' | 'weekly'; label: string }[] = [
  { key: 'once', label: 'No set time' },
  { key: 'today', label: 'At a time' },
  { key: 'weekly', label: 'Every week' },
];

const HINT: Record<Rule, string> = {
  clock: 'Goes to Deadlines with a placeholder time you can set later.',
  place: 'Joins that place’s queue and only surfaces when you are there.',
  none: 'Gets a defence slot and starts counting neglect from today.',
};

/** Title → rule → when → stream → place. The same form on both layouts. */
export function CaptureSheet({ variant }: { variant: 'desktop' | 'phone' }) {
  const { state, clock, actions } = usePlanner();
  if (!state.captureOpen) return null;

  const d = state.draft;
  const canSave = d.title.trim().length > 0;
  const isPlace = d.rule === 'place';
  const isClock = d.rule === 'clock';
  const timed = isPlace && d.repeat !== 'once';

  const preview = (() => {
    const [hh, mm] = (d.time || '').split(':').map(Number);
    if (hh === undefined || Number.isNaN(hh)) return 'Enter a time as the client gave it to you.';
    const due = nextInZone(d.tz, hh || 0, mm || 0, clock.now);
    return `${d.time} ${zoneCity(d.tz, SEED_ZONES)}  →  ${absLabel(due, clock)} EAT`;
  })();

  return (
    <div className={styles.scrim} onClick={(e) => e.target === e.currentTarget && actions.closeCapture()}>
      <div
        className={variant === 'phone' ? styles.sheet : styles.window}
        style={{ animation: variant === 'phone' ? ANIM.sheet : ANIM.pop }}
        role="dialog"
        aria-modal="true"
        aria-label="New item"
      >
        {variant === 'phone' && <div className={styles.grab} />}

        <div className={styles.head}>
          <div className={styles.title}>New item</div>
          <input
            className={styles.titleInput}
            value={d.title}
            placeholder="What is it?"
            autoFocus
            onChange={(e) => actions.setDraft({ title: e.target.value })}
          />
        </div>

        <div className={styles.block}>
          <span className={styles.label}>Which rule governs it</span>
          <div className={styles.rules}>
            {RULES.map((r) => {
              const on = d.rule === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  className={styles.rule}
                  aria-pressed={on}
                  style={{
                    borderColor: on ? r.color : 'rgba(255,255,255,.12)',
                    background: on ? 'rgba(110,128,132,.3)' : 'transparent',
                  }}
                  onClick={() => actions.setDraft({ rule: r.key })}
                >
                  <span className={styles.ruleDot} style={{ background: r.color }} />
                  <span className={styles.ruleLabel}>{r.label}</span>
                  <span className={styles.ruleSub}>{r.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isPlace && (
          <div className={styles.block}>
            <span className={styles.label}>When it goes live</span>
            <div className={styles.segments}>
              {REPEATS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={styles.segment}
                  aria-pressed={d.repeat === o.key}
                  style={{
                    background: d.repeat === o.key ? '#636366' : 'transparent',
                    color: d.repeat === o.key ? '#FFFFFF' : 'rgba(233,240,240,.6)',
                  }}
                  onClick={() => actions.setDraft({ repeat: o.key })}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {d.repeat === 'weekly' && (
              <div className={styles.dows}>
                {DOW.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    className={styles.dow}
                    aria-pressed={d.dow === i}
                    style={{
                      background: d.dow === i ? '#FF7A5C' : 'rgba(110,128,132,.24)',
                      color: d.dow === i ? '#FFFFFF' : 'rgba(233,240,240,.7)',
                    }}
                    onClick={() => actions.setDraft({ dow: i as Dow })}
                  >
                    {name.slice(0, 2)}
                  </button>
                ))}
              </div>
            )}

            {timed && (
              <div className={styles.timeRow}>
                <input
                  className={`${styles.time} tnum`}
                  value={d.time}
                  placeholder="09:00"
                  onChange={(e) => actions.setDraft({ time: e.target.value })}
                />
                <span className={styles.timeNote}>
                  EAT — your own clock. It goes live at this time and counts down to it.
                </span>
              </div>
            )}
          </div>
        )}

        {isClock && (
          <div className={styles.block}>
            <span className={styles.label}>Their time, exactly as they gave it</span>
            <div className={styles.clockGrid}>
              <input
                className={`${styles.time} tnum`}
                value={d.time}
                placeholder="15:00"
                onChange={(e) => actions.setDraft({ time: e.target.value })}
              />
              <select
                className={styles.select}
                value={d.tz}
                onChange={(e) => actions.setDraft({ tz: e.target.value })}
              >
                {SEED_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={`${styles.preview} tnum`}>{preview}</div>
          </div>
        )}

        <div className={styles.pair}>
          <div className={styles.field}>
            <span className={styles.label}>Stream</span>
            <select
              className={styles.select}
              value={d.stream}
              onChange={(e) =>
                actions.setDraft({ stream: e.target.value as (typeof SEED_STREAMS)[number]['name'] })
              }
            >
              {SEED_STREAMS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {/* The place field dims when the rule is not "place". */}
          <div className={styles.field} style={{ opacity: isPlace ? 1 : 0.4 }}>
            <span className={styles.label}>Place</span>
            <select
              className={styles.select}
              value={d.place}
              onChange={(e) => actions.setDraft({ place: e.target.value })}
            >
              {places(state).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.foot}>
          <span className={styles.hint}>{HINT[d.rule]}</span>
          <span className={styles.footButtons}>
            <button type="button" className={styles.cancel} onClick={actions.closeCapture}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.save}
              disabled={!canSave}
              style={{
                background: canSave ? '#E85E42' : 'rgba(110,128,132,.24)',
                color: canSave ? '#FFFFFF' : 'rgba(233,240,240,.4)',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
              onClick={actions.saveDraft}
            >
              Save
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

export { hhmm };
