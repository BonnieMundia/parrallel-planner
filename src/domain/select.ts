/**
 * Every selector here is a pure function of (state, clock) and unit-testable without
 * React. Nothing reads the host timezone or calls `new Date()` — the instant always
 * arrives in the Clock.
 *
 * The ordering rules, in one place, because they are the product:
 *   clock-locked  soonest deadline first
 *   place-locked  grouped by place, groups by their soonest item, timed before untimed
 *   locked to nothing  most-neglected first
 * A stream filter floats matching items to the top of every list; order inside each
 * group is untouched.
 */

import {
  DOW,
  DAY_MS,
  dayKey,
  fromNow,
  gap,
  hhmm,
  parts,
  zoneAbbr,
  zoneCity,
  zonedToUTC,
} from '../app/clock';
import type { Clock } from '../app/clock';
import { DEFAULTS, SEED_BLOCKS, SEED_MARKS, SEED_PLACES, SEED_TASKS, SEED_ZONES } from './seed';
import type { PlannerState } from './state';
import { isNoneTask, isPlaceTask } from './types';
import type {
  Block,
  ClockTask,
  Dow,
  NoneTask,
  Place,
  PlaceId,
  PlaceTask,
  Rule,
  Task,
  TaskId,
  UnclaimedMark,
} from './types';

// --- the world, with overlays applied ------------------------------------------

export function places(state: PlannerState): readonly Place[] {
  return [...SEED_PLACES, ...state.places];
}

export function tasks(state: PlannerState): readonly Task[] {
  return [...SEED_TASKS, ...state.added].filter((t) => !state.removed.includes(t.id));
}

export function taskById(state: PlannerState): ReadonlyMap<TaskId, Task> {
  return new Map(tasks(state).map((t) => [t.id, t]));
}

export function findTask(state: PlannerState, id: TaskId): Task | undefined {
  return tasks(state).find((t) => t.id === id);
}

/** Live work under a rule: not completed, not an ended series. */
export function byRule(state: PlannerState, rule: 'clock'): ClockTask[];
export function byRule(state: PlannerState, rule: 'place'): PlaceTask[];
export function byRule(state: PlannerState, rule: 'none'): NoneTask[];
export function byRule(state: PlannerState, rule: Rule): Task[];
export function byRule(state: PlannerState, rule: Rule): Task[] {
  return tasks(state).filter(
    (t) => t.rule === rule && state.done[t.id] === undefined && state.ended[t.id] === undefined,
  );
}

/** Null for an id with no place behind it — the caller decides what to say. */
export function findPlace(state: PlannerState, id: PlaceId): Place | null {
  return places(state).find((p) => p.id === id) ?? null;
}

export function placeName(state: PlannerState, id: PlaceId): string {
  return findPlace(state, id)?.name ?? 'Somewhere';
}

/** Minutes one way. An unknown place is assumed to be 15 minutes out. */
export function travelTo(state: PlannerState, id: PlaceId | undefined): number {
  if (id === undefined) return 15;
  return findPlace(state, id)?.travel ?? 15;
}

/** '~45m' → 45, '~2h' → 120. Anything unparseable is half an hour. */
export function minsOf(t: Task): number {
  const est = isPlaceTask(t) ? (t.est ?? '') : '';
  const h = /([\d.]+)\s*h/.exec(est);
  const m = /(\d+)\s*m/.exec(est);
  const total = (h?.[1] ? parseFloat(h[1]) * 60 : 0) + (m?.[1] ? Number(m[1]) : 0);
  return total || 30;
}

export function isRecurring(t: Task): t is PlaceTask {
  return isPlaceTask(t) && t.dow !== undefined;
}

// --- clock-locked ---------------------------------------------------------------

/**
 * `moved` wins over everything, then a stored instant, then an absolute hour today
 * (rolling to tomorrow once past), then hours from load — which is what keeps the
 * seed rolling whenever the app is opened.
 */
export function dueOf(state: PlannerState, clock: Clock, t: Task): Date {
  const moved = state.moved[t.id];
  if (moved !== undefined) return new Date(moved);
  if (t.rule === 'clock' && t.dueAt !== undefined) return new Date(t.dueAt);

  const at = t.rule === 'clock' || t.rule === 'place' ? t.at : undefined;
  if (at !== undefined) {
    const p = parts(clock.t0, clock.tz);
    const h = Math.floor(at);
    const mi = Math.round((at % 1) * 60);
    const d = zonedToUTC(clock.tz, p.y, p.mo - 1, p.d, h, mi);
    return d <= clock.t0 ? zonedToUTC(clock.tz, p.y, p.mo - 1, p.d + 1, h, mi) : d;
  }

  const hours = t.rule === 'clock' ? (t.h ?? 24) : 24;
  return new Date(clock.t0.getTime() + hours * 3_600_000);
}

/** The countdown as the top bar and every clock row show it. */
export function countdown(state: PlannerState, clock: Clock, t: Task): ReturnType<typeof gap> {
  return gap(dueOf(state, clock, t), clock.now);
}

const SET_BY: Record<string, string> = {
  client: 'Set by the client',
  call: 'Agreed on the call',
  reviewer: 'Set with the reviewer',
  agency: 'Set by the agency',
  portal: 'Portal deadline — no one to ask',
};

export function setByLabel(t: ClockTask): string {
  return (t.who !== undefined ? SET_BY[t.who] : undefined) ?? 'Set by you';
}

/** 'HH:MM ABBR who' in the zone whoever set it was using. */
export function theirClock(state: PlannerState, clock: Clock, t: ClockTask): string {
  if (t.tz === undefined) return '—';
  const d = dueOf(state, clock, t);
  return `${hhmm(d, t.tz)} ${zoneAbbr(t.tz, d)}${t.who !== undefined ? ` ${t.who}` : ''}`;
}

export function theirCity(t: ClockTask): string {
  return t.tz !== undefined ? zoneCity(t.tz, SEED_ZONES) : 'No zone set';
}

/**
 * Where a missed deadline honestly goes: two hours from now, or 09:00 tomorrow once
 * the day is spent.
 */
export function proposal(clock: Clock): Date {
  const p = parts(clock.now, clock.tz);
  if (p.h < 19) return zonedToUTC(clock.tz, p.y, p.mo - 1, p.d, Math.min(21, p.h + 2), 0);
  return zonedToUTC(clock.tz, p.y, p.mo - 1, p.d + 1, 9, 0);
}

// --- place-locked ---------------------------------------------------------------

/**
 * When a place-locked item next goes live, skipping any day it was skipped on.
 * Null means it has no clock at all — it happens whenever you are there.
 */
export function nextActive(state: PlannerState, clock: Clock, t: PlaceTask): Date | null {
  if (t.at === undefined) return null;
  if (state.ended[t.id] !== undefined) return null;

  const skipped = state.skips[t.id] ?? [];
  const stepDays = t.dow === undefined ? 1 : 7;
  const roll = (d: Date): Date => {
    let guard = 0;
    let out = d;
    while (skipped.includes(dayKey(out, clock.tz)) && guard++ < 12) {
      out = new Date(out.getTime() + stepDays * DAY_MS);
    }
    return out;
  };

  const p = parts(clock.now, clock.tz);
  const h = Math.floor(t.at);
  const mi = Math.round((t.at % 1) * 60);

  if (t.dow === undefined) {
    const d = zonedToUTC(clock.tz, p.y, p.mo - 1, p.d, h, mi);
    return roll(d <= clock.now ? zonedToUTC(clock.tz, p.y, p.mo - 1, p.d + 1, h, mi) : d);
  }

  const delta = (t.dow - DOW.indexOf(p.dow as (typeof DOW)[number]) + 7) % 7;
  const d = zonedToUTC(clock.tz, p.y, p.mo - 1, p.d + delta, h, mi);
  return roll(
    d <= clock.now ? zonedToUTC(clock.tz, p.y, p.mo - 1, p.d + delta + 7, h, mi) : d,
  );
}

/** Milliseconds until an item goes live. Infinity for untimed work, which sinks it. */
export function soonest(state: PlannerState, clock: Clock, t: PlaceTask): number {
  const d = nextActive(state, clock, t);
  return d ? d.getTime() - clock.now.getTime() : Infinity;
}

export interface ActiveLabel {
  at: string;
  in: string;
  hot: boolean;
}

export function activeLabel(state: PlannerState, clock: Clock, t: PlaceTask): ActiveLabel {
  const d = nextActive(state, clock, t);
  if (!d) return { at: 'No set time', in: 'whenever you are there', hot: false };
  const today = d.toDateString() === clock.now.toDateString();
  const day = t.dow !== undefined ? DOW[t.dow] : DOW[(d.getDay() + 6) % 7];
  return {
    at: hhmm(d, clock.tz) + (today ? ' today' : ` ${day ?? ''}`),
    in: fromNow(d, clock.now),
    hot: d.getTime() - clock.now.getTime() < 3_600_000,
  };
}

export interface LeaveBy {
  at: Date;
  /** 'Leave by 12:35 · 25 min away' */
  label: string;
  travel: number;
  /** Inside the hour, or already gone. Turns amber. */
  urgent: boolean;
}

/** For a timed place item: due − travel to that place. Absent when neither applies. */
export function leaveBy(state: PlannerState, clock: Clock, t: PlaceTask): LeaveBy | null {
  const next = nextActive(state, clock, t);
  const travel = travelTo(state, t.place);
  if (!next || travel <= 0) return null;
  const at = new Date(next.getTime() - travel * 60000);
  return {
    at,
    label: `Leave by ${hhmm(at, clock.tz)} · ${travel} min away`,
    travel,
    urgent: at.getTime() - clock.now.getTime() < 3_600_000,
  };
}

// --- ordering -------------------------------------------------------------------

/**
 * A picked stream floats to the top of any list; order inside each group is
 * untouched, which Array.prototype.sort's stability guarantees.
 */
function streamFirst<T extends Task>(state: PlannerState, arr: readonly T[]): T[] {
  const picked = state.stream;
  if (!picked) return [...arr];
  return [...arr].sort(
    (a, b) => (a.stream === picked ? 0 : 1) - (b.stream === picked ? 0 : 1),
  );
}

/** Clock-locked, soonest deadline first. */
export function clockList(state: PlannerState, clock: Clock): ClockTask[] {
  const sorted = [...byRule(state, 'clock')].sort(
    (a, b) => dueOf(state, clock, a).getTime() - dueOf(state, clock, b).getTime(),
  );
  return streamFirst(state, sorted);
}

export interface PlaceGroupItem {
  task: PlaceTask;
  label: ActiveLabel;
  leave: LeaveBy | null;
  recurring: boolean;
  /** '~45m · queued 3d' */
  meta: string;
}

export interface PlaceGroup {
  place: Place;
  items: PlaceGroupItem[];
  /** The place the user is standing in. Renders live. */
  here: boolean;
  /** Every other group, when context awareness is on. */
  dim: boolean;
  /** 'live · 3' · '2 h 10 m' · '4 waiting' */
  status: string;
}

/**
 * One group per place that actually holds work. Groups sort by their soonest item,
 * items sort the same way inside — so untimed errands (Infinity) sink to the bottom
 * of their group, and a place holding only untimed work sinks to the bottom overall.
 * The place you are standing in is not moved; it is lit.
 */
export function placeGroups(state: PlannerState, clock: Clock): PlaceGroup[] {
  const live = byRule(state, 'place');
  const used = places(state).filter((p) => live.some((t) => t.place === p.id));
  const soonestAt = (id: PlaceId): number =>
    Math.min(...live.filter((t) => t.place === id).map((t) => soonest(state, clock, t)));
  const hasStream = (id: PlaceId): number =>
    state.stream && live.some((t) => t.place === id && t.stream === state.stream) ? 0 : 1;

  return [...used]
    .sort((a, b) => hasStream(a.id) - hasStream(b.id) || soonestAt(a.id) - soonestAt(b.id))
    .map((place) => {
      const here = place.id === state.here;
      const byTime = [...live.filter((t) => t.place === place.id)].sort(
        (a, b) => soonest(state, clock, a) - soonest(state, clock, b),
      );
      const items = streamFirst(state, byTime).map((task) => ({
        task,
        label: activeLabel(state, clock, task),
        leave: leaveBy(state, clock, task),
        recurring: isRecurring(task),
        meta: (task.est ?? '~30m') + (task.queued !== undefined ? ` · queued ${task.queued}` : ''),
      }));
      const next = byTime[0] ? nextActive(state, clock, byTime[0]) : null;
      return {
        place,
        items,
        here,
        dim: state.settings.contextAware && !here,
        status: here
          ? `live · ${items.length}`
          : next
            ? fromNow(next, clock.now).replace(' from now', '')
            : `${items.length} waiting`,
      };
    });
}

/**
 * Locked to nothing, most-neglected first. DATA_MODEL specifies this ordering; the
 * prototype left the list in seed order, which hid the 19-day bench rig the Defended
 * card names by name. Following the doc — flagged for the designer.
 */
export function noneList(state: PlannerState): NoneTask[] {
  const sorted = [...byRule(state, 'none')].sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0));
  return streamFirst(state, sorted);
}

export function lossesOf(state: PlannerState, id: TaskId): number {
  const t = findTask(state, id);
  const seeded = t && isNoneTask(t) ? (t.lost ?? 0) : 0;
  return seeded + (state.losses[id] ?? 0);
}

// --- the one trip ----------------------------------------------------------------

export interface TripStop {
  place: Place;
  items: PlaceTask[];
  travel: number;
  /** Minutes of work at this stop. */
  work: number;
  /** '2 items · 60 min there · 12 min out' */
  line: string;
}

export interface Trip {
  stops: TripStop[];
  /** Door-to-door minutes: farthest × 2 + 8 per extra stop + all the work. */
  mins: number;
  back: Date;
  /** Only worth offering for more than one stop. */
  on: boolean;
  label: string;
  total: string;
  /** 'Leave now, back by 16:05 · 25 min to the far end' */
  backLabel: string;
}

export function trip(state: PlannerState, clock: Clock): Trip {
  const live = byRule(state, 'place');
  const stops: TripStop[] = places(state)
    .filter(
      (p) =>
        travelTo(state, p.id) > 0 && live.some((t) => t.place === p.id && t.at === undefined),
    )
    .map((place) => {
      const items = live.filter((t) => t.place === place.id && t.at === undefined);
      const work = items.reduce((a, t) => a + minsOf(t), 0);
      const travel = travelTo(state, place.id);
      return {
        place,
        items,
        travel,
        work,
        line: `${items.length}${items.length === 1 ? ' item · ' : ' items · '}${work} min there · ${travel} min out`,
      };
    })
    .sort((a, b) => a.travel - b.travel);

  const far = stops.length ? Math.max(...stops.map((s) => s.travel)) : 0;
  const mins = far * 2 + Math.max(0, stops.length - 1) * 8 + stops.reduce((a, s) => a + s.work, 0);
  const back = new Date(clock.now.getTime() + mins * 60000);

  return {
    stops,
    mins,
    back,
    on: stops.length > 1,
    label: `${stops.length} stops, one trip`,
    total: `${Math.round(mins / 5) * 5} min door to door`,
    backLabel: `Leave now, back by ${hhmm(back, clock.tz)} · ${far} min to the far end`,
  };
}

// --- what the week kept ----------------------------------------------------------

/** Consecutive days ending today with at least one completion. */
export function streak(state: PlannerState, clock: Clock): number {
  const days = new Set(Object.values(state.done).map((ts) => dayKey(new Date(ts), clock.tz)));
  let n = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(clock.now.getTime() - i * DAY_MS);
    if (days.has(dayKey(d, clock.tz))) n++;
    // Today being empty does not break a streak that is still alive underneath it.
    else if (i > 0) break;
  }
  return n;
}

export interface Quota {
  hours: number;
  target: number;
  pct: number;
  /** '4.8 / 6 h' */
  label: string;
}

/** Defended hours only count once the work inside the block is ticked off. */
export function quota(state: PlannerState): Quota {
  const earned = SEED_BLOCKS.filter((b) => {
    if (b.t === null || state.done[b.t] === undefined) return false;
    return findTask(state, b.t)?.rule === 'none';
  }).reduce((a, b) => a + (b.e - b.s), 0);

  const hours = DEFAULTS.baseDefendedHours + earned;
  const target = DEFAULTS.weeklyDefenceQuotaHours;
  return {
    hours,
    target,
    pct: Math.min(100, Math.round((hours / target) * 100)),
    label: `${hours.toFixed(1)} / ${target} h`,
  };
}

// --- the week grid ---------------------------------------------------------------

export function todayIndex(clock: Clock): Dow {
  const i = DOW.indexOf(parts(clock.t0, clock.tz).dow as (typeof DOW)[number]);
  return (i < 0 ? 0 : i) as Dow;
}

/** How far the authored calendar has to rotate so today's plan is today's. */
export function weekShift(clock: Clock): number {
  return (todayIndex(clock) - DEFAULTS.authoredToday + 7) % 7;
}

/**
 * Floating work rotates onto the current week; anything with a real weekday — church,
 * the barber, the midweek meeting — stays anchored to it.
 */
function rotate<T extends { t?: TaskId | null; d: Dow }>(
  state: PlannerState,
  clock: Clock,
  list: readonly T[],
): T[] {
  const k = weekShift(clock);
  return list.map((x) => {
    const t = x.t ? findTask(state, x.t) : null;
    if (t && isPlaceTask(t) && t.dow !== undefined) return { ...x, d: t.dow };
    return { ...x, d: ((x.d + k) % 7) as Dow };
  });
}

export function rotatedBlocks(state: PlannerState, clock: Clock): Block[] {
  return rotate(state, clock, SEED_BLOCKS);
}

export function rotatedMarks(state: PlannerState, clock: Clock): UnclaimedMark[] {
  return rotate(state, clock, SEED_MARKS);
}

export function todayBlocks(state: PlannerState, clock: Clock): Block[] {
  const today = todayIndex(clock);
  return rotatedBlocks(state, clock).filter((b) => b.d === today);
}

/** Monday of the week being shown, in host-local terms for calendar arithmetic. */
export function monday(state: PlannerState, clock: Clock): Date {
  const p = parts(clock.t0, clock.tz);
  return new Date(p.y, p.mo - 1, p.d - todayIndex(clock) + state.wk * 7);
}

export function weekNumber(mon: Date): number {
  const thu = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 3);
  const jan1 = new Date(thu.getFullYear(), 0, 1);
  return Math.ceil(((thu.getTime() - jan1.getTime()) / DAY_MS + 1) / 7);
}

export function weekRange(mon: Date, months: readonly string[]): string {
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const same = mon.getMonth() === sun.getMonth();
  const head = mon.getDate() + (same ? '' : ` ${months[mon.getMonth()] ?? ''}`);
  return `${head} – ${sun.getDate()} ${months[sun.getMonth()] ?? ''}`;
}

// --- summary counts ---------------------------------------------------------------

export interface RuleCounts {
  clock: number;
  place: number;
  none: number;
}

export function ruleCounts(state: PlannerState): RuleCounts {
  return {
    clock: byRule(state, 'clock').length,
    place: byRule(state, 'place').length,
    none: byRule(state, 'none').length,
  };
}

/** Deadlines inside eight hours — what the greeting and the summary line count. */
export function hotCount(state: PlannerState, clock: Clock): number {
  return clockList(state, clock).filter((t) => countdown(state, clock, t).hot).length;
}
