/**
 * Turns the bundled seed into rows for a user's own tables — ADR-001 §13 item 11.
 *
 * The interesting work is §5.1: `h` and `at` are authoring conveniences that mean
 * "relative to when the app opened". They cannot survive a database, because two
 * devices opening at different times would compute different deadlines for the same
 * task. Both are resolved to a concrete instant exactly once, here.
 *
 * Repeating place work is the exception: it keeps `repeat_dow` + `repeat_at` as a
 * recurrence rule, because "every Sunday at 09:00" is not one instant and
 * nextActive() already resolves it at read time.
 *
 * Pure — takes the seed and a clock, returns rows. No Supabase types, no network.
 */

import { parts, zonedToUTC } from '../../app/clock';
import type { Clock } from '../../app/clock';
import { SEED_BLOCKS, SEED_PLACES, SEED_TASKS } from '../seed';
import { isClockTask, isNoneTask, isPlaceTask } from '../types';
import type { Task } from '../types';

export interface PlaceRow {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  travel_minutes: number;
}

export interface TaskRow {
  id: string;
  user_id: string;
  rule: 'clock' | 'place' | 'none';
  stream: string;
  title: string;
  short: string | null;
  place_id: string | null;
  due_at: string | null;
  setter_tz: string | null;
  who: string | null;
  pct: number | null;
  sleeps: boolean;
  note: string | null;
  notes: string | null;
  repeat_dow: number | null;
  repeat_at: number | null;
  est_minutes: number | null;
  queued_since: string | null;
  sub: string | null;
  last_touched_at: string | null;
}

export interface BlockRow {
  id: string;
  user_id: string;
  task_id: string | null;
  dow: number;
  starts_at: number;
  ends_at: number;
  label: string | null;
}

export interface SeedRows {
  places: PlaceRow[];
  tasks: TaskRow[];
  blocks: BlockRow[];
  /** Seed id → generated uuid, so blocks and tasks can point at each other. */
  ids: Record<string, string>;
}

const DAY_MS = 86_400_000;

/** '~45m' → 45, '~2h' → 120. Mirrors minsOf, without the 30-minute default. */
function estMinutes(est: string | undefined): number | null {
  if (!est) return null;
  const h = /([\d.]+)\s*h/.exec(est);
  const m = /(\d+)\s*m/.exec(est);
  const total = (h?.[1] ? parseFloat(h[1]) * 60 : 0) + (m?.[1] ? Number(m[1]) : 0);
  return total || null;
}

/**
 * The one-time resolution of a clock deadline to a stored instant.
 * `at` is that hour on the clock's own day; `h` is hours from it.
 */
export function resolveDueAt(task: Task, clock: Clock): Date | null {
  if (!isClockTask(task)) return null;
  if (task.dueAt !== undefined) return new Date(task.dueAt);
  if (task.at !== undefined) {
    const p = parts(clock.now, clock.tz);
    return zonedToUTC(
      clock.tz,
      p.y,
      p.mo - 1,
      p.d,
      Math.floor(task.at),
      Math.round((task.at % 1) * 60),
    );
  }
  return new Date(clock.now.getTime() + (task.h ?? 24) * 3_600_000);
}

export function buildSeedRows(userId: string, clock: Clock, newId: () => string): SeedRows {
  const ids: Record<string, string> = {};
  const idFor = (seedId: string): string => (ids[seedId] ??= newId());

  const places: PlaceRow[] = SEED_PLACES.map((p) => ({
    id: idFor(`place:${p.id}`),
    user_id: userId,
    name: p.name,
    kind: p.kind,
    travel_minutes: p.travel,
  }));

  const tasks: TaskRow[] = SEED_TASKS.map((t) => {
    const due = resolveDueAt(t, clock);
    const row: TaskRow = {
      id: idFor(`task:${t.id}`),
      user_id: userId,
      rule: t.rule,
      stream: t.stream,
      title: t.title,
      short: t.short ?? null,
      place_id: t.place !== undefined ? idFor(`place:${t.place}`) : null,
      due_at: due ? due.toISOString() : null,
      setter_tz: isClockTask(t) ? (t.tz ?? null) : null,
      who: isClockTask(t) ? (t.who ?? null) : null,
      pct: isClockTask(t) ? (t.pct ?? null) : null,
      sleeps: isClockTask(t) ? t.sleep === true : false,
      note: isClockTask(t) ? (t.note ?? null) : null,
      notes: isClockTask(t) ? (t.notes ?? null) : null,
      repeat_dow: isPlaceTask(t) ? (t.dow ?? null) : null,
      repeat_at: isPlaceTask(t) ? (t.at ?? null) : null,
      est_minutes: isPlaceTask(t) ? estMinutes(t.est) : null,
      queued_since: null,
      sub: isNoneTask(t) ? (t.sub ?? null) : null,
      // staleDays is "how long since this was touched", which is a date once stored.
      last_touched_at: isNoneTask(t)
        ? new Date(clock.now.getTime() - (t.staleDays ?? 0) * DAY_MS).toISOString()
        : null,
    };
    return row;
  });

  const blocks: BlockRow[] = SEED_BLOCKS.map((b) => ({
    id: newId(),
    user_id: userId,
    task_id: b.t !== null ? idFor(`task:${b.t}`) : null,
    dow: b.d,
    starts_at: b.s,
    ends_at: b.e,
    label: b.label ?? null,
  }));

  return { places, tasks, blocks, ids };
}
