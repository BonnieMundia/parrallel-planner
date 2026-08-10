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
  absLabel,
  dayKey,
  dayName,
  fromNow,
  gap,
  hhmm,
  offsetMin,
  parts,
  sameDay,
  urgency,
  zoneAbbr,
  zoneCity,
  zonedToUTC,
} from '../app/clock';
import type { Clock, Urgency } from '../app/clock';
import {
  DEFAULTS,
  SEED_BLOCKS,
  SEED_MARKS,
  SEED_PLACES,
  SEED_STREAMS,
  SEED_TASKS,
  SEED_ZONES,
} from './seed';
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

/** Clock-locked, soonest deadline first, before any stream filter is applied. */
export function clockByDue(state: PlannerState, clock: Clock): ClockTask[] {
  return [...byRule(state, 'clock')].sort(
    (a, b) => dueOf(state, clock, a).getTime() - dueOf(state, clock, b).getTime(),
  );
}

/** Clock-locked, soonest deadline first. */
export function clockList(state: PlannerState, clock: Clock): ClockTask[] {
  return streamFirst(state, clockByDue(state, clock));
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

export interface WeekDay {
  dow: string;
  /** Date of the month, as shown in the column head. */
  num: string;
  isToday: boolean;
  blocks: Block[];
  marks: UnclaimedMark[];
}

/**
 * Standing commitments repeat in every week. A one-off deadline only appears in the
 * week it actually falls in, so scrolling back does not show it four times.
 */
export function weekDays(state: PlannerState, clock: Clock): WeekDay[] {
  const mon = monday(state, clock);
  const start = mon.getTime();
  const end = start + 7 * DAY_MS;
  const off = state.wk;

  const inWeek = (b: Block): boolean => {
    if (off === 0) return true;
    if (b.t === null) return false;
    const t = findTask(state, b.t);
    if (!t) return false;
    if (t.rule !== 'clock') return true;
    const d = dueOf(state, clock, t).getTime();
    return d >= start && d < end;
  };

  const blocks = rotatedBlocks(state, clock).filter(inWeek);
  const marks = off === 0 ? rotatedMarks(state, clock) : [];
  const today = todayIndex(clock);

  return DOW.map((dow, i) => ({
    dow,
    num: String(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i).getDate()),
    isToday: off === 0 && i === today,
    blocks: blocks.filter((b) => b.d === i),
    marks: marks.filter((m) => m.d === i),
  }));
}

export interface ReviewRow {
  name: string;
  color: string;
  keptPct: number;
  /** '4 of 6 blocks kept' */
  blocks: string;
  /** '2 ticked · 1 given away' */
  done: string;
  dim: number;
}

/** What the week actually kept, per stream. */
export function reviewRows(state: PlannerState, clock: Clock): ReviewRow[] {
  const all = tasks(state);
  const rotated = rotatedBlocks(state, clock);

  return SEED_STREAMS.map((meta) => {
    const owned = all.filter((t) => t.stream === meta.name);
    const doneN = owned.filter((t) => state.done[t.id] !== undefined).length;
    const lostN = owned.reduce((a, t) => a + lossesOf(state, t.id), 0);
    const blocksN = rotated.filter(
      (b) => b.t !== null && findTask(state, b.t)?.stream === meta.name,
    ).length;
    const kept = Math.max(0, blocksN - lostN);

    return {
      name: meta.name === 'Personal builds' ? 'Builds' : meta.name,
      color: meta.color,
      keptPct: blocksN ? Math.round((kept / blocksN) * 100) : 0,
      blocks: blocksN ? `${kept} of ${blocksN} blocks kept` : 'no blocks booked',
      done: `${doneN} ticked · ${lostN} given away`,
      dim: blocksN || doneN ? 1 : 0.45,
    };
  });
}

// --- the phone's deciding surface ---------------------------------------------------

export interface Hero {
  id: TaskId;
  /** Minutes the focus timer opens with. */
  mins: number;
  kicker: string;
  stream: string;
  title: string;
  /** The one big number. */
  big: string;
  bigNote: string;
  why: string;
  cta: string;
  tint: string;
  /** Urgency tier the card animates at. */
  tier: Urgency;
}

/**
 * The single next thing. Standing somewhere wins over any clock — place work stops
 * being possible the moment you leave. Otherwise it is the soonest deadline, but only
 * while it is actually close; when nothing is pressing, the defended slot takes the card.
 */
export function hero(state: PlannerState, clock: Clock, where: PlaceId): Hero {
  const live = byRule(state, 'place');
  const here = live.filter((t) => t.place === where);

  if (here.length > 0) {
    const sorted = [...here].sort((a, b) => soonest(state, clock, a) - soonest(state, clock, b));
    const first = sorted[0];
    if (first) {
      const label = activeLabel(state, clock, first);
      const untimed = label.at === 'No set time';
      return {
        id: first.id,
        mins: minsOf(first),
        kicker: 'You are here',
        stream: first.stream,
        title: first.title,
        big: untimed ? String(here.length) : (label.at.split(' ')[0] ?? label.at),
        bigNote: untimed ? `items at ${placeName(state, where)} · no set time` : label.in,
        why: 'Soonest first. These are here because you are here, and they stop being possible the moment you leave.',
        cta: 'Take it',
        tint: 'rgba(240,169,59,.16)',
        tier: 0,
      };
    }
  }

  const next = clockByDue(state, clock)[0];
  if (next && countdown(state, clock, next).hot) {
    const due = dueOf(state, clock, next);
    return {
      id: next.id,
      mins: 90,
      kicker: 'Do this now',
      stream: next.stream,
      title: next.title,
      big: countdown(state, clock, next).v,
      bigNote: `until ${hhmm(due, clock.tz)} EAT · ${theirClock(state, clock, next)}`,
      why: 'The only thing today with money attached and under eight hours on it. Everything else can wait until it is done.',
      cta: 'Start · 90 min',
      tint: 'rgba(255,122,92,.16)',
      tier: urgency(due, clock.now),
    };
  }

  return {
    id: 'bench',
    mins: 45,
    kicker: 'Nothing needs you',
    stream: 'Personal builds',
    title: '45 minutes are unclaimed at 20:15',
    big: '19d',
    bigNote: 'since the bench rig was last opened',
    why: 'No deadline is close enough to justify skipping this again. This is the slot the app defends unless you give it away.',
    cta: 'Defend it',
    tint: 'rgba(53,214,160,.16)',
    tier: next ? urgency(dueOf(state, clock, next), clock.now) : 0,
  };
}

export interface NextRow {
  id: TaskId;
  title: string;
  color: string;
  sub: string;
  right: string;
  /** Place work you are not standing in dims — it is not available to you now. */
  usable: boolean;
  tier: Urgency;
}

/** What follows the hero: the rest of where you are, then the clock. Or the reverse. */
export function phoneNext(state: PlannerState, clock: Clock, where: PlaceId): NextRow[] {
  const byDue = clockByDue(state, clock);
  const byPlace = [...byRule(state, 'place')].sort(
    (a, b) => soonest(state, clock, a) - soonest(state, clock, b),
  );
  const here = byPlace.filter((t) => t.place === where);

  const picked: Task[] =
    here.length > 0
      ? [...here.slice(1, 3), ...byDue.slice(0, 2)]
      : [...byDue.slice(1, 3), ...byPlace.slice(0, 2)];

  return picked.map((t) => {
    const isPlace = t.rule === 'place';
    const usable = !isPlace || t.place === where;
    const color = SEED_STREAMS.find((s) => s.name === t.stream)?.color ?? '#FF5C8A';

    if (isPlace) {
      const label = activeLabel(state, clock, t);
      return {
        id: t.id,
        title: t.title,
        color,
        sub: usable
          ? `${label.at} · ${label.in}`
          : `${placeName(state, t.place)} · ${label.at}`,
        right:
          label.at === 'No set time' ? (t.est ?? '~30m') : label.in.replace(' from now', ''),
        usable,
        tier: 0,
      };
    }

    const due = dueOf(state, clock, t);
    return {
      id: t.id,
      title: t.title,
      color,
      sub: absLabel(due, clock),
      right: gap(due, clock.now).v,
      usable,
      tier: urgency(due, clock.now),
    };
  });
}

// --- zones -------------------------------------------------------------------------

/** The band is the user's own working day, 06:00 to 23:00. */
const DAY_A = 6;
const DAY_B = 23;

export interface ZoneRow {
  title: string;
  color: string;
  /** Percentage across the band. */
  left: number;
  /** Chips past halfway flip to the left of their mark so they stay readable. */
  chipShift: string;
  mine: string;
  theirs: string;
  day: string;
  /** Set when the deadline lands outside 08:00–21:00 here. */
  flag: string;
  outside: boolean;
}

export interface ZoneGroup {
  city: string;
  abbr: string;
  delta: string;
  rows: ZoneRow[];
}

export function zoneTicks(): { label: string; left: number }[] {
  return [6, 9, 12, 15, 18, 21, 23].map((h) => ({
    label: String(h).padStart(2, '0'),
    left: ((h - DAY_A) / (DAY_B - DAY_A)) * 100,
  }));
}

/** Every deadline placed on the user's own day, with the clock it shows on theirs. */
export function zoneGroups(state: PlannerState, clock: Clock): ZoneGroup[] {
  const grouped = new Map<string, ClockTask[]>();
  for (const t of clockByDue(state, clock)) {
    const tz = t.tz ?? clock.tz;
    const list = grouped.get(tz);
    if (list) list.push(t);
    else grouped.set(tz, [t]);
  }

  return [...grouped.entries()].map(([tz, items]) => {
    const off =
      Math.round(((offsetMin(tz, clock.now) - offsetMin(clock.tz, clock.now)) / 60) * 10) / 10;

    return {
      city: zoneCity(tz, SEED_ZONES),
      abbr: zoneAbbr(tz, clock.now),
      delta: off === 0 ? 'same clock as you' : `${off > 0 ? '+' : ''}${off}h from you`,
      rows: items.map((t) => {
        const d = dueOf(state, clock, t);
        const p = parts(d, clock.tz);
        const h = p.h + p.mi / 60;
        const outside = h < 8 || h >= 21;
        const left = Math.max(
          0,
          Math.min(97, ((Math.max(DAY_A, Math.min(DAY_B, h)) - DAY_A) / (DAY_B - DAY_A)) * 100),
        );
        return {
          title: t.short ?? t.title,
          color: SEED_STREAMS.find((s) => s.name === t.stream)?.color ?? '#FF5C8A',
          left,
          chipShift: left > 55 ? '-100%' : '0',
          mine: hhmm(d, clock.tz),
          theirs: t.tz !== undefined ? `${hhmm(d, t.tz)} ${zoneAbbr(t.tz, d)}` : hhmm(d, clock.tz),
          day: sameDay(d, clock.now, clock.tz) ? 'today' : dayName(d, clock.tz),
          flag: outside ? (h < 8 ? 'before you start' : 'after your last block') : '',
          outside,
        };
      }),
    };
  });
}

/** How many deadlines land outside the working day. Drives the line under the title. */
export function zoneClash(state: PlannerState, clock: Clock): number {
  return zoneGroups(state, clock).reduce(
    (a, g) => a + g.rows.filter((r) => r.outside).length,
    0,
  );
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
