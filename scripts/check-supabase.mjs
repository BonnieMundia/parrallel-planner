/*
 * Checks the Supabase project the .env points at, without starting the app.
 *
 * Auth and the Data API are separately switchable, so they are probed separately —
 * a project can hold a perfectly valid key while PostgREST refuses every request.
 * Run with: npm run check:supabase
 */

import { readFileSync } from 'node:fs';

function env() {
  try {
    const raw = readFileSync('.env', 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

const e = env();
const url = e.VITE_SUPABASE_URL;
const key = e.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('✗ .env is missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.');
  if (Object.keys(e).some((k) => k.startsWith('NEXT_PUBLIC_'))) {
    console.error('  Found NEXT_PUBLIC_* names — that is Next.js convention; Vite needs VITE_*.');
  }
  process.exit(1);
}

console.log(`project  ${url}`);

const probe = async (path, label) => {
  try {
    const res = await fetch(`${url}${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    console.log(`${res.ok ? '✓' : '✗'} ${label.padEnd(22)} ${res.status}`);
    return res.ok;
  } catch (err) {
    console.log(`✗ ${label.padEnd(22)} ${err.message}`);
    return false;
  }
};

const auth = await probe('/auth/v1/settings', 'auth');
const rest = await probe('/rest/v1/', 'data api');
const tables = await probe('/rest/v1/profiles?select=id&limit=1', 'profiles table');

console.log('');
if (!auth) {
  console.log('The key is not valid for this project. Check Project Settings → API keys.');
} else if (!rest) {
  console.log('The key is valid — auth accepted it — but the Data API is refusing requests.');
  console.log('Check Project Settings → Data API is enabled, and that the publishable');
  console.log('key is permitted for it. Nothing in the app can read or write until it is.');
} else if (!tables) {
  console.log('Connected, but the schema is missing. Apply supabase/migrations/0001_init.sql');
  console.log('in the SQL editor, or via the Supabase CLI.');
} else {
  console.log('Reachable, and the schema is present.');
}

process.exit(auth && rest && tables ? 0 : 1);
