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

const call = async (path) => {
  try {
    const res = await fetch(`${url}${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, body: err.message };
  }
};

const say = (ok, label, note) => console.log(`${ok ? '✓' : '✗'} ${label.padEnd(16)} ${note}`);

// Auth validates the key: a bad one is rejected here, so this settles the credential.
const auth = await call('/auth/v1/settings');
say(auth.status === 200, 'key', auth.status === 200 ? 'accepted by auth' : `rejected (${auth.status})`);

/*
 * Do NOT probe /rest/v1/ to decide whether the Data API works. That root path serves
 * the OpenAPI spec and is restricted for anon keys on a perfectly healthy project, so
 * its 401 says nothing. Ask for a table that cannot exist instead: PostgREST answering
 * PGRST205 "could not find the table" proves it authenticated the request and looked.
 */
const probe = await call('/rest/v1/_pp_probe_no_such_table?select=*');
const restOk = probe.status !== 401 && probe.status !== 0;
say(restOk, 'data api', restOk ? 'reachable and authenticating' : `refusing requests (${probe.status})`);

const profiles = await call('/rest/v1/profiles?select=id&limit=1');
const missing = profiles.body.includes('PGRST205');
const schemaOk = profiles.status === 200;
say(schemaOk, 'schema', schemaOk ? 'migration applied' : missing ? 'tables not created yet' : `unexpected (${profiles.status})`);

console.log('');
if (auth.status !== 200) {
  console.log('The key is not valid for this project. Check Project Settings → API keys.');
} else if (!restOk) {
  console.log('The Data API is refusing authenticated requests. Check it is enabled in');
  console.log('Project Settings → Data API, and that `public` is an exposed schema.');
} else if (!schemaOk) {
  console.log('Connected. The schema is not there yet — apply:');
  console.log('  supabase/migrations/0001_init.sql');
  console.log('in the Supabase SQL editor, then run this again.');
} else {
  console.log('Reachable, and the schema is present.');
}

process.exit(auth.status === 200 && restOk && schemaOk ? 0 : 1);
