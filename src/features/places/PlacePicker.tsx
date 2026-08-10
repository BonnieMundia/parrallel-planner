import { usePlanner } from '../../app/store';
import { byRule, places } from '../../domain/select';
import { PALETTE } from '../../ui/tokens';
import { ANIM } from '../../ui/tokens';
import styles from './PlacePicker.module.css';

/**
 * Desktop renders a popover anchored under the sidebar button; the phone renders a
 * bottom sheet. Same list, same footer.
 */
export function PlacePicker({ variant }: { variant: 'desktop' | 'phone' }) {
  const { state, actions } = usePlanner();
  if (!state.pickerOpen) return null;

  const current = variant === 'phone' ? state.aHere : state.here;
  const live = byRule(state, 'place');

  const rows = places(state).map((p) => {
    const waiting = live.filter((t) => t.place === p.id).length;
    return {
      ...p,
      waiting,
      sub: `${p.kind}${waiting ? ` · ${waiting} waiting` : ' · nothing waiting'}`,
    };
  });

  const list = (
    <>
      {rows.map((p, i) => (
        <button
          key={p.id}
          type="button"
          className={styles.row}
          aria-current={p.id === current}
          style={{
            borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none',
            background: p.id === current ? 'rgba(53,214,160,.14)' : 'transparent',
          }}
          onClick={() => {
            actions.goTo(p.id);
            actions.closePicker();
            if (p.waiting) {
              actions.push(
                `You are at ${p.name}`,
                `${p.waiting} ${p.waiting === 1 ? 'item is' : 'items are'} live here now.`,
                PALETTE.workshop,
              );
            }
          }}
        >
          <span
            className={styles.dot}
            style={{ background: p.waiting ? PALETTE.workshop : 'rgba(233,240,240,.3)' }}
          />
          <span className={styles.text}>
            <span className={styles.name}>{p.name}</span>
            <span className={styles.sub}>{p.sub}</span>
          </span>
          {p.id === current && <span className={styles.tick}>✓</span>}
        </button>
      ))}
    </>
  );

  const footer = (
    <div className={styles.footer}>
      <input
        className={styles.input}
        value={state.newPlace}
        placeholder="Add a place…"
        onChange={(e) => actions.setNewPlace(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && actions.addPlace()}
      />
      <button type="button" className={styles.add} onClick={actions.addPlace}>
        Add
      </button>
    </div>
  );

  if (variant === 'desktop') {
    return (
      <>
        <div className={styles.dismiss} onClick={actions.closePicker} />
        <div className={styles.popover} role="dialog" aria-modal="true" aria-label="Places">
          <div className={styles.popoverHead}>Places</div>
          <div className={styles.list}>{list}</div>
          {footer}
        </div>
      </>
    );
  }

  return (
    <div
      className={styles.scrim}
      onClick={(e) => e.target === e.currentTarget && actions.closePicker()}
    >
      <div
        className={styles.sheet}
        style={{ animation: ANIM.sheet }}
        role="dialog"
        aria-modal="true"
        aria-label="Where are you"
      >
        <div className={styles.grab} />
        <div className={styles.sheetHead}>Where are you</div>
        <div className={styles.list}>{list}</div>
        {footer}
      </div>
    </div>
  );
}
