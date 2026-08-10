/**
 * The seed is read from sample_data.json verbatim — it was tuned so the screens hit
 * their real density and every edge case (a deadline while asleep, a 19-day-neglected
 * project, two errands at the same place, a repeat that can be skipped).
 *
 * It is parsed rather than cast: each rule branch copies only the fields that belong
 * to it, so a place-locked task cannot pick up a `pct` and a clock-locked one cannot
 * pick up a `queued`. Malformed data throws at module load, not three screens later.
 */

import raw from './sample_data.json';
import type {
  Block,
  ClockTask,
  Defaults,
  Dow,
  NoneTask,
  Place,
  PlaceKind,
  PlaceTask,
  Rule,
  Stream,
  StreamMeta,
  StreamRule,
  Task,
  UnclaimedMark,
  Who,
  Zone,
} from './types';

const STREAMS = [
  'Contract',
  'Writing',
  'Personal builds',
  'Applications',
  'Life & errands',
] as const satisfies readonly Stream[];

const STREAM_RULES = ['Clock', 'Place', 'Nothing', 'Mixed'] as const satisfies readonly StreamRule[];
const PLACE_KINDS = [
  'Where you work',
  'Errands',
  'Standing places',
  'Yours',
] as const satisfies readonly PlaceKind[];
const RULES = ['clock', 'place', 'none'] as const satisfies readonly Rule[];
const WHOS = ['client', 'call', 'reviewer', 'agency', 'portal'] as const satisfies readonly Who[];

// --- readers -------------------------------------------------------------------

class SeedError extends Error {
  constructor(where: string, detail: string) {
    super(`sample_data.json — ${where}: ${detail}`);
    this.name = 'SeedError';
  }
}

function record(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new SeedError(where, `expected an object, got ${JSON.stringify(v)}`);
  }
  return v as Record<string, unknown>;
}

function array(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) throw new SeedError(where, 'expected an array');
  return v;
}

function optStr(o: Record<string, unknown>, k: string, where: string): string | undefined {
  const v = o[k];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new SeedError(where, `${k} must be a string`);
  return v;
}

function str(o: Record<string, unknown>, k: string, where: string): string {
  const v = optStr(o, k, where);
  if (v === undefined) throw new SeedError(where, `${k} is required`);
  return v;
}

function optNum(o: Record<string, unknown>, k: string, where: string): number | undefined {
  const v = o[k];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new SeedError(where, `${k} must be a finite number`);
  }
  return v;
}

function num(o: Record<string, unknown>, k: string, where: string): number {
  const v = optNum(o, k, where);
  if (v === undefined) throw new SeedError(where, `${k} is required`);
  return v;
}

function optBool(o: Record<string, unknown>, k: string, where: string): boolean | undefined {
  const v = o[k];
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new SeedError(where, `${k} must be a boolean`);
  return v;
}

function optDow(o: Record<string, unknown>, k: string, where: string): Dow | undefined {
  const v = optNum(o, k, where);
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || v < 0 || v > 6) throw new SeedError(where, `${k} must be 0–6`);
  return v as Dow;
}

function dow(o: Record<string, unknown>, k: string, where: string): Dow {
  const v = optDow(o, k, where);
  if (v === undefined) throw new SeedError(where, `${k} is required`);
  return v;
}

function optOneOf<T extends string>(
  allowed: readonly T[],
  o: Record<string, unknown>,
  k: string,
  where: string,
): T | undefined {
  const v = o[k];
  if (v === undefined) return undefined;
  const hit = allowed.find((a) => a === v);
  if (hit === undefined) throw new SeedError(where, `${k} must be one of ${allowed.join(' | ')}`);
  return hit;
}

function oneOf<T extends string>(
  allowed: readonly T[],
  o: Record<string, unknown>,
  k: string,
  where: string,
): T {
  const v = optOneOf(allowed, o, k, where);
  if (v === undefined) throw new SeedError(where, `${k} is required`);
  return v;
}

// --- parsers -------------------------------------------------------------------

function toPlace(v: unknown, i: number): Place {
  const where = `places[${i}]`;
  const o = record(v, where);
  return {
    id: str(o, 'id', where),
    name: str(o, 'name', where),
    kind: oneOf(PLACE_KINDS, o, 'kind', where),
    travel: num(o, 'travel', where),
  };
}

function toStreamMeta(v: unknown, i: number): StreamMeta {
  const where = `streams[${i}]`;
  const o = record(v, where);
  return {
    name: oneOf(STREAMS, o, 'name', where),
    rule: oneOf(STREAM_RULES, o, 'rule', where),
    color: str(o, 'color', where),
    chipBg: str(o, 'chipBg', where),
  };
}

function toZone(v: unknown, i: number): Zone {
  const where = `zones[${i}]`;
  const o = record(v, where);
  return { id: str(o, 'id', where), label: str(o, 'label', where) };
}

function toTask(v: unknown, i: number): Task {
  const where = `tasks[${i}]`;
  const o = record(v, where);

  const common = {
    id: str(o, 'id', where),
    stream: oneOf(STREAMS, o, 'stream', where),
    title: str(o, 'title', where),
    ...spread('short', optStr(o, 'short', where)),
  };

  const rule = oneOf(RULES, o, 'rule', where);

  if (rule === 'clock') {
    const t: ClockTask = {
      ...common,
      rule: 'clock',
      ...spread('place', optStr(o, 'place', where)),
      ...spread('at', optNum(o, 'at', where)),
      ...spread('h', optNum(o, 'h', where)),
      ...spread('dueAt', optNum(o, 'dueAt', where)),
      ...spread('tz', optStr(o, 'tz', where)),
      ...spread('who', optOneOf(WHOS, o, 'who', where)),
      ...spread('pct', optNum(o, 'pct', where)),
      ...spread('sleep', optBool(o, 'sleep', where)),
      ...spread('note', optStr(o, 'note', where)),
      ...spread('notes', optStr(o, 'notes', where)),
    };
    return t;
  }

  if (rule === 'place') {
    const t: PlaceTask = {
      ...common,
      rule: 'place',
      place: str(o, 'place', where),
      ...spread('at', optNum(o, 'at', where)),
      ...spread('dow', optDow(o, 'dow', where)),
      ...spread('est', optStr(o, 'est', where)),
      ...spread('queued', optStr(o, 'queued', where)),
    };
    return t;
  }

  const t: NoneTask = {
    ...common,
    rule: 'none',
    ...spread('place', optStr(o, 'place', where)),
    ...spread('sub', optStr(o, 'sub', where)),
    ...spread('staleDays', optNum(o, 'staleDays', where)),
    ...spread('lost', optNum(o, 'lost', where)),
  };
  return t;
}

/** Omits the key entirely when the value is absent, so optional fields stay absent. */
function spread<K extends string, V>(k: K, v: V | undefined): { [P in K]?: V } {
  return v === undefined ? {} : ({ [k]: v } as { [P in K]: V });
}

function toBlock(v: unknown, i: number): Block {
  const where = `blocks[${i}]`;
  const o = record(v, where);
  const t = o['t'];
  if (t !== null && typeof t !== 'string') throw new SeedError(where, 't must be a task id or null');
  return {
    t,
    d: dow(o, 'd', where),
    s: num(o, 's', where),
    e: num(o, 'e', where),
    ...spread('label', optStr(o, 'label', where)),
  };
}

function toMark(v: unknown, i: number): UnclaimedMark {
  const where = `unclaimedMarks[${i}]`;
  const o = record(v, where);
  return {
    d: dow(o, 'd', where),
    at: num(o, 'at', where),
    stream: oneOf(STREAMS, o, 'stream', where),
  };
}

function toDefaults(v: unknown): Defaults {
  const where = 'defaults';
  const o = record(v, where);
  return {
    localStorageKey: str(o, 'localStorageKey', where),
    homeTimezone: str(o, 'homeTimezone', where),
    weeklyDefenceQuotaHours: num(o, 'weeklyDefenceQuotaHours', where),
    baseDefendedHours: num(o, 'baseDefendedHours', where),
    authoredToday: dow(o, 'authoredToday', where),
    focusMinutes: num(o, 'focusMinutes', where),
  };
}

// --- the seed ------------------------------------------------------------------

const root = record(raw, 'root');

export const SEED_STREAMS: readonly StreamMeta[] = array(root['streams'], 'streams').map(
  toStreamMeta,
);
export const SEED_PLACES: readonly Place[] = array(root['places'], 'places').map(toPlace);
export const SEED_ZONES: readonly Zone[] = array(root['zones'], 'zones').map(toZone);
export const SEED_TASKS: readonly Task[] = array(root['tasks'], 'tasks').map(toTask);
export const SEED_BLOCKS: readonly Block[] = array(root['blocks'], 'blocks').map(toBlock);
export const SEED_MARKS: readonly UnclaimedMark[] = array(
  root['unclaimedMarks'],
  'unclaimedMarks',
).map(toMark);
export const DEFAULTS: Defaults = toDefaults(root['defaults']);

/** Sidebar order, and the order streams appear in every legend and review grid. */
export const STREAM_NAMES: readonly Stream[] = SEED_STREAMS.map((s) => s.name);

/** Every task id in the seed, for cheap referential checks. */
const SEED_IDS = new Set(SEED_TASKS.map((t) => t.id));
const PLACE_IDS = new Set(SEED_PLACES.map((p) => p.id));

for (const t of SEED_TASKS) {
  if (t.place !== undefined && !PLACE_IDS.has(t.place)) {
    throw new SeedError(`tasks (${t.id})`, `place '${t.place}' is not in places`);
  }
}
for (const b of SEED_BLOCKS) {
  if (b.t !== null && !SEED_IDS.has(b.t)) {
    throw new SeedError('blocks', `t '${b.t}' is not a task id`);
  }
}
