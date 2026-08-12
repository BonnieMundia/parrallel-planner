/**
 * The only module that talks to Supabase. Everything above it deals in PlannerState
 * and plain rows, which is what keeps select.ts a pure function of (state, clock).
 *
 * Nothing here throws on a network failure. Sync is additive: the planner opens from
 * localStorage and must keep working when this layer cannot reach anything.
 */

import { supabase } from './supabase';
import { foldEvents } from '../domain/sync/foldEvents';
import type { Overlays, TaskEventRow } from '../domain/sync/foldEvents';
import { EMPTY_OVERLAYS } from '../domain/sync/foldEvents';
import { buildSeedRows } from '../domain/sync/seedRows';
import type { Clock } from '../app/clock';

export interface Result<T> {
  data: T | null;
  error: string | null;
}

const ok = <T>(data: T): Result<T> => ({ data, error: null });
const fail = <T>(error: string): Result<T> => ({ data: null, error });

const message = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error';

// --- auth ---------------------------------------------------------------------------

/**
 * Magic link: no password to store, lose or reset, and the fewest screens — which
 * matters when the designer has not drawn any of them (ADR-001 §12 Q1).
 */
/**
 * Where the emailed link should land.
 *
 * Not simply window.location.origin: asking for a link from the dev server puts a
 * localhost URL in an email, and an email is read wherever the person happens to be —
 * usually a phone, where localhost is the phone. VITE_SITE_URL names somewhere the
 * link is actually reachable; the current origin is the fallback for a real deployment.
 */
export function signInRedirectTo(): string {
  const configured = import.meta.env['VITE_SITE_URL'];
  if (typeof configured === 'string' && configured.length > 0) return configured;

  const origin = window.location.origin;
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin);
  // A localhost link in an email is a dead end on any other device. Say so loudly
  // rather than sending one and letting it fail in the reader's hands.
  if (local) console.warn('Sign-in link will point at localhost. Set VITE_SITE_URL.');
  return origin;
}

export async function signIn(email: string): Promise<Result<null>> {
  if (!supabase) return fail('Supabase is not configured.');
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: signInRedirectTo() },
    });
    return error ? fail(error.message) : ok(null);
  } catch (e) {
    return fail(message(e));
  }
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

// --- seed import --------------------------------------------------------------------

/** Whether this user already has their own copy of the world. */
export async function hasSeed(userId: string): Promise<Result<boolean>> {
  if (!supabase) return fail('Supabase is not configured.');
  try {
    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    return error ? fail(error.message) : ok((count ?? 0) > 0);
  } catch (e) {
    return fail(message(e));
  }
}

/**
 * One-time, per user. Places go first so tasks can reference them, and blocks last so
 * they can reference tasks — the foreign keys make the order load-bearing.
 */
export async function importSeed(userId: string, clock: Clock): Promise<Result<number>> {
  if (!supabase) return fail('Supabase is not configured.');

  const already = await hasSeed(userId);
  if (already.error) return fail(already.error);
  if (already.data) return ok(0);

  const rows = buildSeedRows(userId, clock, () => crypto.randomUUID());

  try {
    const places = await supabase.from('places').insert(rows.places);
    if (places.error) return fail(`places: ${places.error.message}`);

    const tasks = await supabase.from('tasks').insert(rows.tasks);
    if (tasks.error) return fail(`tasks: ${tasks.error.message}`);

    const blocks = await supabase.from('blocks').insert(rows.blocks);
    if (blocks.error) return fail(`blocks: ${blocks.error.message}`);

    return ok(rows.tasks.length);
  } catch (e) {
    return fail(message(e));
  }
}

// --- the event log --------------------------------------------------------------------

export async function pullOverlays(userId: string): Promise<Result<Overlays>> {
  if (!supabase) return fail('Supabase is not configured.');
  try {
    const { data, error } = await supabase
      .from('task_events')
      .select('id, task_id, kind, payload, occurred_at')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: true });

    if (error) return fail(error.message);
    return ok(foldEvents((data ?? []) as unknown as TaskEventRow[]));
  } catch (e) {
    return fail(message(e));
  }
}

/**
 * Ids are generated by the client, so `ignoreDuplicates` makes a replay a no-op. A
 * flush interrupted halfway can therefore be retried wholesale rather than reconciled.
 */
export async function pushEvents(
  userId: string,
  events: readonly (TaskEventRow & { device_id?: string })[],
): Promise<Result<number>> {
  if (!supabase) return fail('Supabase is not configured.');
  if (events.length === 0) return ok(0);

  try {
    const { error } = await supabase
      .from('task_events')
      .upsert(
        events.map((e) => ({ ...e, user_id: userId })),
        { onConflict: 'id', ignoreDuplicates: true },
      );
    return error ? fail(error.message) : ok(events.length);
  } catch (e) {
    return fail(message(e));
  }
}

export { EMPTY_OVERLAYS };
