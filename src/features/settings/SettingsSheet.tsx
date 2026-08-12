import { usePlanner } from '../../app/store';
import type { Settings } from '../../domain/state';
import { SheetModal } from '../../ui/primitives';
import styles from './SettingsSheet.module.css';

/**
 * The four knobs DATA_MODEL asks to be exposed as user settings. They were already
 * honoured by the selectors; nothing could change them.
 *
 * The designer has not drawn this screen, so the labels here are the ones DATA_MODEL
 * uses and the descriptions are its own words for what each knob does. Worth replacing
 * with real copy before it ships to anyone but you.
 */
const CHOICES: {
  key: 'clockStyle' | 'projectDefense';
  label: string;
  note: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: 'clockStyle',
    label: 'Clocks',
    note: 'Countdowns, or the time it actually lands.',
    options: [
      { value: 'countdown', label: 'Countdown' },
      { value: 'absolute', label: 'Absolute' },
    ],
  },
  {
    key: 'projectDefense',
    label: 'The defended card reports',
    note: 'Hours held, days neglected, or both.',
    options: [
      { value: 'quota', label: 'Quota' },
      { value: 'neglect', label: 'Neglect' },
      { value: 'both', label: 'Both' },
    ],
  },
];

export function SettingsSheet() {
  const { state, actions } = usePlanner();
  if (!state.settingsOpen) return null;

  const s = state.settings;

  return (
    <SheetModal open title="Settings" onClose={actions.closeSettings}>
      <div className={styles.field}>
        <span className={styles.label}>Sync</span>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => {
            actions.closeSettings();
            actions.openSignIn();
          }}
        >
          <span className={styles.toggleText}>
            {state.userId ? 'Signed in' : 'This device only'}
          </span>
          <span className={styles.label}>▸</span>
        </button>
        <span className={styles.note}>
          {state.userId
            ? 'Your work syncs to every device you sign in on.'
            : 'Sign in to share your work between devices.'}
        </span>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Your name</span>
        <input
          className={styles.input}
          value={s.userName}
          onChange={(e) => actions.setSetting({ userName: e.target.value })}
        />
        <span className={styles.note}>Used in the greeting.</span>
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Context awareness</span>
        <button
          type="button"
          className={styles.toggle}
          role="switch"
          aria-checked={s.contextAware}
          onClick={() => actions.setSetting({ contextAware: !s.contextAware })}
        >
          <span className={styles.toggleText}>
            {s.contextAware ? 'Only where you are is live' : 'Everything reads live'}
          </span>
          <span
            className={styles.track}
            style={{ background: s.contextAware ? 'rgba(53,214,160,.5)' : 'rgba(110,128,132,.4)' }}
          >
            <span
              className={styles.knob}
              style={{ transform: s.contextAware ? 'translateX(18px)' : 'none' }}
            />
          </span>
        </button>
        <span className={styles.note}>Off, place groups stop dimming.</span>
      </div>

      {CHOICES.map((c) => (
        <div key={c.key} className={styles.field}>
          <span className={styles.label}>{c.label}</span>
          <div className={styles.segments}>
            {c.options.map((o) => {
              const on = s[c.key] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  className={styles.segment}
                  aria-pressed={on}
                  style={{
                    background: on ? '#636366' : 'transparent',
                    color: on ? '#FFFFFF' : 'rgba(233,240,240,.6)',
                  }}
                  onClick={() =>
                    actions.setSetting({ [c.key]: o.value } as Partial<Settings>)
                  }
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <span className={styles.note}>{c.note}</span>
        </div>
      ))}
    </SheetModal>
  );
}
