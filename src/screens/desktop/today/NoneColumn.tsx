import { usePlanner } from '../../../app/store';
import { byRule, lossesOf, noneList, quota } from '../../../domain/select';
import { Card, CountdownBar, Tick } from '../../../ui/primitives';
import { INK, PALETTE } from '../../../ui/tokens';
import { streamFade } from '../../../ui/streams';
import { DoneCollapsible } from './DoneCollapsible';
import styles from './Columns.module.css';

export function NoneColumn() {
  const { state, actions } = usePlanner();
  const all = noneList(state);
  const rows = all.slice(0, 3);
  const q = quota(state);

  const defence = {
    quota: {
      label: 'Weekly quota',
      value: `${q.hours.toFixed(1)} / ${q.target}.0 h`,
      note: 'Hours only count once the work inside the block is ticked off.',
    },
    neglect: {
      label: 'Longest neglect',
      value: '19 days',
      note: 'The bench rig has not been opened since 19 July. It has lost to a deadline six times.',
    },
    both: {
      label: 'Defended this week',
      value: `${q.hours.toFixed(1)} / ${q.target}.0 h`,
      note: 'Counts finished work only. Longest neglect: 19 days on the bench rig.',
    },
  }[state.settings.projectDefense];

  return (
    <div className={styles.column}>
      <div className={styles.head}>
        <span className={styles.dot} style={{ background: PALETTE.build }} />
        <span className={styles.headName}>Locked to nothing</span>
        <span className={styles.headCount}>{byRule(state, 'none').length}</span>
      </div>

      <div className={styles.defence}>
        <div className={styles.defenceHead}>
          <span className={styles.defenceLabel}>{defence.label}</span>
          <span className={`${styles.defenceValue} tnum`}>{defence.value}</span>
        </div>
        <CountdownBar pct={q.pct} color={PALETTE.build} height={6} />
        <div className={styles.defenceNote}>{defence.note}</div>
      </div>

      <Card interactive>
        {rows.map((t, i) => {
          const stale = t.staleDays ?? 0;
          const neglected = stale > 7;
          return (
            <div
              key={t.id}
              className={styles.noneRow}
              style={{
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.08)',
                opacity: streamFade(state.stream, t.stream),
              }}
            >
              <div className={styles.rowTop}>
                <span className={styles.rowTitleWrap}>
                  <Tick label="Mark done" onClick={() => actions.completeTask(t.id)} />
                  <span className={styles.title}>{t.title}</span>
                </span>
                <span className={styles.rowTools}>
                  <span
                    className={`${styles.stale} tnum`}
                    style={{ color: neglected ? PALETTE.alarm : 'rgba(233,240,240,.58)' }}
                  >
                    {stale}d untouched
                  </span>
                  <button
                    type="button"
                    className={styles.remove}
                    title="Delete"
                    onClick={() => actions.removeTask(t.id)}
                  >
                    ×
                  </button>
                </span>
              </div>
              <div className={styles.noneSub}>
                {t.sub ?? ''} · surrendered {lossesOf(state, t.id)}×
              </div>
              <button
                type="button"
                className={styles.defend}
                style={{
                  background: neglected ? PALETTE.build : 'rgba(53,214,160,.2)',
                  color: neglected ? INK.onBuild : INK.green,
                }}
                onClick={() => actions.setTab('week')}
              >
                Defend a block
              </button>
            </div>
          );
        })}
      </Card>

      <DoneCollapsible rule="none" doneKey="self" />

      <div className={styles.note}>No client, no date. It only happens if you defend it.</div>
    </div>
  );
}
