import { describe, expect, it } from 'vitest';
import {
  DEFAULTS,
  SEED_BLOCKS,
  SEED_MARKS,
  SEED_PLACES,
  SEED_STREAMS,
  SEED_TASKS,
  SEED_ZONES,
  STREAM_NAMES,
} from './seed';
import { isClockTask, isNoneTask, isPlaceTask } from './types';
import type { Task } from './types';

const byId = new Map<string, Task>(SEED_TASKS.map((t) => [t.id, t]));
const task = (id: string): Task => {
  const t = byId.get(id);
  if (!t) throw new Error(`no seed task '${id}'`);
  return t;
};

describe('seed shape', () => {
  it('loads 5 streams, 7 places, 22 tasks, 27 blocks, 3 marks, 10 zones', () => {
    expect(SEED_STREAMS).toHaveLength(5);
    expect(SEED_PLACES).toHaveLength(7);
    expect(SEED_TASKS).toHaveLength(22);
    expect(SEED_BLOCKS).toHaveLength(27);
    expect(SEED_MARKS).toHaveLength(3);
    expect(SEED_ZONES).toHaveLength(10);
  });

  it('splits 6 on a clock, 8 on a place, 8 on nothing', () => {
    expect(SEED_TASKS.filter(isClockTask)).toHaveLength(6);
    expect(SEED_TASKS.filter(isPlaceTask)).toHaveLength(8);
    expect(SEED_TASKS.filter(isNoneTask)).toHaveLength(8);
  });

  it('gives every task a unique id', () => {
    expect(new Set(SEED_TASKS.map((t) => t.id)).size).toBe(SEED_TASKS.length);
  });

  it('keeps the sidebar stream order', () => {
    expect(STREAM_NAMES).toEqual([
      'Contract',
      'Writing',
      'Personal builds',
      'Applications',
      'Life & errands',
    ]);
  });

  it('carries the documented defaults', () => {
    expect(DEFAULTS.localStorageKey).toBe('parallelPlanner.ios.v2');
    expect(DEFAULTS.homeTimezone).toBe('Africa/Nairobi');
    expect(DEFAULTS.weeklyDefenceQuotaHours).toBe(6);
    expect(DEFAULTS.baseDefendedHours).toBe(3.5);
    expect(DEFAULTS.authoredToday).toBe(3);
    expect(DEFAULTS.focusMinutes).toBe(90);
  });
});

describe('one rule per task', () => {
  it('never merges fields from another rule block', () => {
    for (const t of SEED_TASKS) {
      if (isClockTask(t)) {
        expect(t, t.id).not.toHaveProperty('queued');
        expect(t, t.id).not.toHaveProperty('est');
        expect(t, t.id).not.toHaveProperty('staleDays');
      }
      if (isPlaceTask(t)) {
        expect(t, t.id).not.toHaveProperty('pct');
        expect(t, t.id).not.toHaveProperty('tz');
        expect(t, t.id).not.toHaveProperty('lost');
      }
      if (isNoneTask(t)) {
        expect(t, t.id).not.toHaveProperty('at');
        expect(t, t.id).not.toHaveProperty('dow');
        expect(t, t.id).not.toHaveProperty('who');
      }
    }
  });

  it('leaves absent optionals absent rather than undefined', () => {
    const ch3 = task('ch3');
    expect('at' in ch3).toBe(false);
    expect(Object.keys(task('bench')).sort()).toEqual([
      'id',
      'lost',
      'rule',
      'short',
      'staleDays',
      'stream',
      'sub',
      'title',
    ]);
  });

  it('lets a clock task and a none task still name a place', () => {
    const call = task('call');
    expect(isClockTask(call) && call.place).toBe('anywhere');
    const gym = task('gym');
    expect(isNoneTask(gym) && gym.place).toBe('gym');
  });
});

describe('both ways a clock deadline is expressed', () => {
  it('keeps `at` for a fixed hour today', () => {
    const rlhf = task('rlhf');
    expect(isClockTask(rlhf) && rlhf.at).toBe(23);
    expect(isClockTask(rlhf) && rlhf.tz).toBe('America/Los_Angeles');
  });

  it('keeps `h` so the demo stays rolling', () => {
    const ch3 = task('ch3');
    expect(isClockTask(ch3) && ch3.h).toBe(26);
  });

  it('has exactly one deadline landing while asleep', () => {
    const asleep = SEED_TASKS.filter(isClockTask).filter((t) => t.sleep === true);
    expect(asleep.map((t) => t.id)).toEqual(['rlhf']);
  });
});

describe('the edge cases the seed was tuned for', () => {
  it('has a 19-day-neglected project', () => {
    const stalest = SEED_TASKS.filter(isNoneTask).reduce((a, b) =>
      (b.staleDays ?? 0) > (a.staleDays ?? 0) ? b : a,
    );
    expect(stalest.id).toBe('bench');
    expect(stalest.staleDays).toBe(19);
  });

  it('has two untimed errands at the same place', () => {
    const atMarket = SEED_TASKS.filter(isPlaceTask).filter(
      (t) => t.place === 'market' && t.at === undefined,
    );
    expect(atMarket.map((t) => t.id)).toEqual(['shop', 'pharmacy']);
  });

  it('has weekly repeats that can be skipped', () => {
    const repeats = SEED_TASKS.filter(isPlaceTask).filter((t) => t.dow !== undefined);
    expect(repeats.map((t) => t.id)).toEqual(['church', 'lunch', 'barber', 'standup']);
    for (const t of repeats) expect(t.at, t.id).toBeTypeOf('number');
  });

  it('has untimed errands that sink below the timed ones', () => {
    const untimed = SEED_TASKS.filter(isPlaceTask).filter((t) => t.at === undefined);
    expect(untimed.map((t) => t.id)).toEqual(['shop', 'pharmacy', 'bank', 'sim']);
  });

  it('has one unclaimed slot on the calendar', () => {
    expect(SEED_BLOCKS.filter((b) => b.t === null)).toHaveLength(1);
  });
});

describe('referential integrity', () => {
  it('points every block at a real task', () => {
    for (const b of SEED_BLOCKS) {
      if (b.t !== null) expect(byId.has(b.t), b.t).toBe(true);
      expect(b.e, `${b.t ?? 'unclaimed'} block`).toBeGreaterThan(b.s);
    }
  });

  it('points every task place at a real place', () => {
    const ids = new Set(SEED_PLACES.map((p) => p.id));
    for (const t of SEED_TASKS) {
      if (t.place !== undefined) expect(ids.has(t.place), t.id).toBe(true);
    }
  });

  it('names a stream that exists on every task, block mark and stream row', () => {
    for (const t of SEED_TASKS) expect(STREAM_NAMES).toContain(t.stream);
    for (const m of SEED_MARKS) expect(STREAM_NAMES).toContain(m.stream);
  });
});
