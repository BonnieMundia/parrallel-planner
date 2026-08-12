import { describe, expect, it } from 'vitest';
import { buildSeedRows, resolveDueAt } from './seedRows';
import type { TaskRow } from './seedRows';
import type { Clock } from '../../app/clock';
import { SEED_BLOCKS, SEED_PLACES, SEED_TASKS } from '../seed';
import { isClockTask } from '../types';

const EAT = 'Africa/Nairobi';
/** Thu 7 Aug 2025, 14:30 EAT. */
const T0 = new Date('2025-08-07T11:30:00Z');
const clock: Clock = { t0: T0, now: T0, tz: EAT };

const USER = '11111111-1111-1111-1111-111111111111';
let n = 0;
const ids = () => `id-${String(++n).padStart(3, '0')}`;
const build = () => {
  n = 0;
  return buildSeedRows(USER, clock, ids);
};

describe('buildSeedRows', () => {
  it('produces a row for every seed record', () => {
    const rows = build();
    expect(rows.places).toHaveLength(SEED_PLACES.length);
    expect(rows.tasks).toHaveLength(SEED_TASKS.length);
    expect(rows.blocks).toHaveLength(SEED_BLOCKS.length);
  });

  it('scopes every row to the user, which is what RLS checks', () => {
    const rows = build();
    for (const r of [...rows.places, ...rows.tasks, ...rows.blocks]) {
      expect(r.user_id).toBe(USER);
    }
  });

  it('gives each seed id one stable uuid, reused by everything pointing at it', () => {
    const rows = build();
    const market = rows.ids['place:market'];
    const shop = rows.tasks.find((t) => t.title.startsWith('Weekly shop'));
    const pharmacy = rows.tasks.find((t) => t.title.startsWith('Collect the prescription'));
    // Two tasks at the same place must resolve to the same place row.
    expect(shop?.place_id).toBe(market);
    expect(pharmacy?.place_id).toBe(market);
  });

  it('points blocks at the same task rows the tasks got', () => {
    const rows = build();
    const rlhf = rows.ids['task:rlhf'];
    const rlhfBlocks = rows.blocks.filter((b) => b.task_id === rlhf);
    expect(rlhfBlocks.length).toBeGreaterThan(0);
    // The unclaimed slot keeps a null task.
    expect(rows.blocks.some((b) => b.task_id === null)).toBe(true);
  });
});

describe('resolving relative deadlines to instants (ADR-001 §5.1)', () => {
  it('turns `at` into that hour on the day it is resolved', () => {
    const rlhf = SEED_TASKS.find((t) => t.id === 'rlhf');
    // 23:00 EAT on 7 Aug is 20:00 UTC.
    expect(resolveDueAt(rlhf!, clock)?.toISOString()).toBe('2025-08-07T20:00:00.000Z');
  });

  it('turns `h` into an instant that many hours out', () => {
    const ch3 = SEED_TASKS.find((t) => t.id === 'ch3');
    expect(resolveDueAt(ch3!, clock)?.toISOString()).toBe('2025-08-08T13:30:00.000Z');
  });

  it('stops being relative: the same task resolved later gives a later instant', () => {
    const ch3 = SEED_TASKS.find((t) => t.id === 'ch3');
    const later: Clock = { ...clock, now: new Date(T0.getTime() + 3_600_000) };
    expect(resolveDueAt(ch3!, later)?.getTime()).toBe(
      (resolveDueAt(ch3!, clock)?.getTime() ?? 0) + 3_600_000,
    );
  });

  it('leaves place and none work without a due_at', () => {
    const rows = build();
    for (const r of rows.tasks) {
      if (r.rule === 'clock') expect(r.due_at, r.title).not.toBeNull();
      else expect(r.due_at, r.title).toBeNull();
    }
  });

  it('keeps a weekly repeat as a rule, not an instant', () => {
    const rows = build();
    const church = rows.tasks.find((t) => t.title === 'Sunday service');
    expect(church?.repeat_dow).toBe(6);
    expect(church?.repeat_at).toBe(9);
    expect(church?.due_at).toBeNull();
  });

  it('turns staleness into a date', () => {
    const rows = build();
    const bench = rows.tasks.find((t) => t.title.startsWith('Bench rig'));
    const days = (T0.getTime() - Date.parse(bench?.last_touched_at ?? '')) / 86_400_000;
    expect(Math.round(days)).toBe(19);
  });

  it('parses estimates into minutes', () => {
    const rows = build();
    expect(rows.tasks.find((t) => t.title === 'Sunday service')?.est_minutes).toBe(120);
    expect(rows.tasks.find((t) => t.title.startsWith('Weekly shop'))?.est_minutes).toBe(45);
  });
});

/**
 * The database enforces one-rule-per-task with CHECK constraints. A violation would
 * only surface as a failed insert against a live project, so it is checked here.
 */
describe('every row satisfies the SQL CHECK constraints', () => {
  const rows = build();

  const clockOnly = (r: TaskRow) =>
    r.rule === 'clock' || (r.due_at === null && r.who === null && r.pct === null);
  const placeOnly = (r: TaskRow) =>
    r.rule === 'place' || (r.repeat_dow === null && r.est_minutes === null);
  const noneOnly = (r: TaskRow) =>
    r.rule === 'none' || (r.sub === null && r.last_touched_at === null);

  it('clock_needs_instant', () => {
    for (const r of rows.tasks) {
      if (r.rule === 'clock') expect(r.due_at, r.title).not.toBeNull();
    }
  });

  it('place_needs_place', () => {
    for (const r of rows.tasks) {
      if (r.rule === 'place') expect(r.place_id, r.title).not.toBeNull();
    }
  });

  it('clock_only, place_only, none_only', () => {
    for (const r of rows.tasks) {
      expect(clockOnly(r), `clock_only: ${r.title}`).toBe(true);
      expect(placeOnly(r), `place_only: ${r.title}`).toBe(true);
      expect(noneOnly(r), `none_only: ${r.title}`).toBe(true);
    }
  });

  it('pct between 0 and 100, dow between 0 and 6', () => {
    for (const r of rows.tasks) {
      if (r.pct !== null) expect(r.pct).toBeGreaterThanOrEqual(0);
      if (r.pct !== null) expect(r.pct).toBeLessThanOrEqual(100);
      if (r.repeat_dow !== null) expect(r.repeat_dow).toBeGreaterThanOrEqual(0);
      if (r.repeat_dow !== null) expect(r.repeat_dow).toBeLessThanOrEqual(6);
    }
  });

  it('blocks end after they start, on a valid day', () => {
    for (const b of rows.blocks) {
      expect(b.ends_at).toBeGreaterThan(b.starts_at);
      expect(b.dow).toBeGreaterThanOrEqual(0);
      expect(b.dow).toBeLessThanOrEqual(6);
    }
  });

  it('places use a kind the constraint allows', () => {
    const allowed = ['Where you work', 'Errands', 'Standing places', 'Yours'];
    for (const p of rows.places) expect(allowed).toContain(p.kind);
  });

  it('uses only setters the enum allows', () => {
    const allowed = ['client', 'call', 'reviewer', 'agency', 'portal'];
    for (const r of rows.tasks) if (r.who !== null) expect(allowed).toContain(r.who);
  });

  it('carries a setter timezone for every clock task, which Zones needs', () => {
    for (const r of rows.tasks) {
      if (r.rule === 'clock') expect(r.setter_tz, r.title).not.toBeNull();
    }
    // And it matches what the seed said, rather than being normalised away.
    const rlhf = SEED_TASKS.find((t) => t.id === 'rlhf');
    const row = rows.tasks.find((t) => t.title.startsWith('RLHF'));
    expect(row?.setter_tz).toBe(isClockTask(rlhf!) ? rlhf.tz : null);
  });
});
