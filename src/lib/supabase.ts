import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vite only exposes variables prefixed VITE_ to client code. A NEXT_PUBLIC_ prefix
 * is Next.js convention and would be silently undefined here, which fails at the
 * first query rather than at boot — so the absence is caught up front instead.
 *
 * Both values are safe in the bundle: the publishable key carries no authority, and
 * Row Level Security is what protects the data.
 */
const url = import.meta.env['VITE_SUPABASE_URL'];
const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];

export const isConfigured = Boolean(url && key);

/**
 * Null when the environment is not configured, so the app keeps running on
 * localStorage alone. Sync is additive — it must never be the reason the planner
 * fails to open.
 */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url as string, key as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface Reachability {
  ok: boolean;
  auth: boolean;
  data: boolean;
  detail: string;
}

/**
 * Auth and the Data API are separately switchable in a Supabase project, and a
 * project can have a perfectly valid key while PostgREST refuses every request.
 * Reporting them apart makes that distinguishable instead of a blank failure.
 */
export async function checkReachability(): Promise<Reachability> {
  if (!supabase || !url || !key) {
    return { ok: false, auth: false, data: false, detail: 'No VITE_SUPABASE_* variables set.' };
  }

  let auth = false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    auth = res.ok;
  } catch {
    auth = false;
  }

  const { error } = await supabase.from('profiles').select('id').limit(1);
  // An empty table is a success; only a transport or permission failure is not.
  const data = !error || error.code === 'PGRST116';
  // PGRST205 is PostgREST saying it looked and the table is not there — which means
  // it authenticated the request. A missing schema and a refused key are different
  // problems with different fixes, so they are never reported as the same thing.
  const schemaMissing = error?.code === 'PGRST205';

  return {
    ok: auth && data,
    auth,
    data,
    detail: !auth
      ? 'Auth rejected the key — check VITE_SUPABASE_PUBLISHABLE_KEY.'
      : schemaMissing
        ? 'Connected, but the schema is missing. Apply supabase/migrations/0001_init.sql.'
        : !data
          ? `Data API refused the request: ${error?.message ?? 'unknown'}.`
          : 'Reachable.',
  };
}
