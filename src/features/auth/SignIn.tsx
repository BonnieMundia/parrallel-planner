import { useState } from 'react';
import { usePlanner } from '../../app/store';
import { isConfigured } from '../../lib/supabase';
import { signIn, signOut } from '../../lib/repository';
import { SheetModal } from '../../ui/primitives';
import styles from './SignIn.module.css';

/**
 * Magic link, per ADR-001 §12 Q1.
 *
 * The copy here is PLACEHOLDER. The designer has drawn no signed-out state, no
 * link-sent confirmation and no session-expired screen, and CLAUDE.md says to ask
 * rather than invent — so these strings are deliberately plain and should be
 * replaced before anyone but the owner sees them.
 */
export function SignIn() {
  const { state, actions } = usePlanner();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state.signInOpen) return null;

  const submit = async (): Promise<void> => {
    const address = email.trim();
    if (!address || busy) return;
    setBusy(true);
    setError(null);
    const res = await signIn(address);
    setBusy(false);
    if (res.error) setError(res.error);
    else setSent(true);
  };

  return (
    <SheetModal open title="Sync" onClose={actions.closeSignIn}>
      {/*
        A sign-in form that cannot possibly work is worse than no form: it reads as
        broken rather than as unavailable. When the build has no Supabase project,
        explain instead of rendering a dead input.
      */}
      {!isConfigured ? (
        <>
          <div className={styles.note}>
            This build has no Supabase project, so there is nothing to sign in to. Your
            work stays on this device.
          </div>
          <div className={styles.note}>
            To turn sync on, set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
            where this is deployed, then rebuild — Vite reads them at build time, not
            when the page loads.
          </div>
        </>
      ) : state.userId ? (
        <>
          <div className={styles.note}>Signed in. Your work syncs to every device.</div>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              void signOut();
              actions.setUser(null);
              actions.closeSignIn();
            }}
          >
            Sign out
          </button>
        </>
      ) : sent ? (
        <div className={styles.note}>
          Check {email} for a link. Opening it on this device signs you in.
        </div>
      ) : (
        <>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              placeholder="you@example.com"
              autoFocus
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="button"
            className={styles.primary}
            disabled={busy || email.trim().length === 0}
            onClick={() => void submit()}
          >
            {busy ? 'Sending…' : 'Send a sign-in link'}
          </button>

          <div className={styles.note}>
            No password. Until you sign in, everything stays on this device.
          </div>
        </>
      )}
    </SheetModal>
  );
}
