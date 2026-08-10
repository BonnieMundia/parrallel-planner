import { usePlanner } from '../../app/store';
import { hhmm, parts } from '../../app/clock';
import { byRule, placeName } from '../../domain/select';
import type { PhoneScreen } from '../../domain/state';
import { Toast } from '../../ui/primitives';
import { ANIM } from '../../ui/tokens';
import { CaptureSheet } from '../../features/capture/CaptureSheet';
import { PlacePicker } from '../../features/places/PlacePicker';
import { FocusOverlay } from '../../features/focus/FocusOverlay';
import { Now } from './Now';
import { Due } from './Due';
import { Week } from './Week';
import { Streams } from './Streams';
import styles from './Phone.module.css';

/** One path each, so the bar is four shapes rather than four icons. */
const NAV_ICONS: Record<PhoneScreen, string> = {
  now: 'M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6M12 6.9V12l3.5 2.1',
  due: 'M6 21.2V3.4M6 5h11.4l-2.2 3.6L17.4 12H6',
  week: 'M4.2 8a2 2 0 0 1 2-2h11.6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2ZM4.2 10.6h15.6M8.6 3.4v4.2M15.4 3.4v4.2',
  streams: 'M3.6 6.6h7M13.4 6.6h7M3.6 12h13.2M3.6 17.4h5.2M12 17.4h8.4',
};

function NavButton({ screen, label }: { screen: PhoneScreen; label: string }) {
  const { state, actions } = usePlanner();
  const on = state.aScreen === screen;
  const color = on ? '#FF9E86' : 'rgba(233,240,240,.5)';

  return (
    <button
      type="button"
      className={styles.navItem}
      aria-current={on ? 'page' : undefined}
      onClick={() => actions.setPhoneScreen(screen)}
    >
      <svg
        viewBox="0 0 24 24"
        className={styles.navIcon}
        fill="none"
        stroke={color}
        strokeWidth={on ? 2.1 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={NAV_ICONS[screen]} />
      </svg>
      <span className={styles.navLabel} style={{ color }}>
        {label}
      </span>
    </button>
  );
}

export function Phone() {
  const { state, clock, actions } = usePlanner();
  const p = parts(clock.now, clock.tz);
  const here = placeName(state, state.aHere);
  const hereCount = byRule(state, 'place').filter((t) => t.place === state.aHere).length;

  return (
    <div className={styles.phone}>
      <div className={styles.header}>
        <div className={styles.headRow}>
          <span className={styles.date}>
            {p.dow} {p.d}
          </span>
          <span className={`${styles.clock} tnum`}>{hhmm(clock.now, clock.tz)}</span>
        </div>
        <button type="button" className={styles.place} onClick={actions.openPicker}>
          <span className={styles.placeDot} />
          <span className={styles.placeText}>
            <span className={styles.placeName}>{here}</span>
            <span className={styles.placeNote}>
              {hereCount ? `${hereCount} waiting here` : 'nothing waiting here'}
            </span>
          </span>
          <span className={styles.caret}>▾</span>
        </button>
      </div>

      {/* Keyed on the screen, so switching tabs replays the entrance. */}
      <div key={state.aScreen} className={styles.scroll} style={{ animation: ANIM.fadeUp }}>
        {state.aScreen === 'now' && <Now />}
        {state.aScreen === 'due' && <Due />}
        {state.aScreen === 'week' && <Week />}
        {state.aScreen === 'streams' && <Streams />}
      </div>

      {state.toast && (
        <Toast
          title={state.toast.title}
          sub={state.toast.sub}
          color={state.toast.color}
          out={state.toastOut}
          placement="phone"
        />
      )}

      <div className={styles.nav}>
        <NavButton screen="now" label="Now" />
        <NavButton screen="due" label="Due" />
        <button
          type="button"
          className={styles.fab}
          aria-label="Capture"
          onClick={actions.openCapture}
        >
          +
        </button>
        <NavButton screen="week" label="Week" />
        <NavButton screen="streams" label="Streams" />
      </div>

      <PlacePicker variant="phone" />
      <CaptureSheet variant="phone" />
      <FocusOverlay variant="phone" />
    </div>
  );
}
