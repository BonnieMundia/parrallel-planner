import { usePlanner } from '../../app/store';
import {
  activeLabel,
  byRule,
  clockByDue,
  dueOf,
  lossesOf,
  placeName,
  theirClock,
} from '../../domain/select';
import { absLabel } from '../../app/clock';
import { SheetModal } from '../../ui/primitives';
import { streamColor } from '../../ui/streams';
import styles from './SurrenderSheet.module.css';

/** Giving a defended block away asks what you are giving it to, and then remembers. */
export function SurrenderSheet() {
  const { state, clock, actions } = usePlanner();
  const sur = state.surrender;
  if (!sur) return null;

  const targets = [
    ...clockByDue(state, clock).slice(0, 3),
    ...byRule(state, 'place').slice(0, 2),
  ];

  return (
    <SheetModal open title="Give the block to" onClose={actions.cancelSurrender}>
      <div className={styles.head}>
        <span className={styles.title}>{sur.title}</span>
        <span className={`${styles.when} tnum`}>{sur.when}</span>
      </div>
      <div className={styles.count}>
        {sur.taskId !== null
          ? `It has already lost this slot ${lossesOf(state, sur.taskId)} times.`
          : 'This slot has never been claimed by anything.'}
      </div>

      <div className={styles.list}>
        {targets.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className={styles.target}
            style={{ borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none' }}
            onClick={() => actions.giveAway(sur, t.title)}
          >
            <span className={styles.dot} style={{ background: streamColor(t.stream) }} />
            <span className={styles.targetText}>
              <span className={styles.targetTitle}>{t.title}</span>
              <span className={styles.targetSub}>
                {t.rule === 'clock'
                  ? `${absLabel(dueOf(state, clock, t), clock)} · ${theirClock(state, clock, t)}`
                  : `${placeName(state, t.place)} · ${activeLabel(state, clock, t).at}`}
              </span>
            </span>
          </button>
        ))}
      </div>

      <button type="button" className={styles.cancel} onClick={actions.cancelSurrender}>
        Keep it
      </button>
    </SheetModal>
  );
}
