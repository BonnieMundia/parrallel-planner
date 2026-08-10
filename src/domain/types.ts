/**
 * A task carries exactly one rule. Fields belonging to the other two rules are
 * absent, not empty — which is why Task is a discriminated union rather than one
 * flat bag of optionals. See DATA_MODEL.md.
 */

export type Rule = 'clock' | 'place' | 'none';

export type Stream = 'Contract' | 'Writing' | 'Applications' | 'Life & errands' | 'Personal builds';

/** How a stream is governed, for the sidebar line under its name. */
export type StreamRule = 'Clock' | 'Place' | 'Nothing' | 'Mixed';

export type PlaceKind = 'Where you work' | 'Errands' | 'Standing places' | 'Yours';

/** Who set a clock deadline. Drives the "Set by X" line. */
export type Who = 'client' | 'call' | 'reviewer' | 'agency' | 'portal';

/** 0 = Mon … 6 = Sun. Used by both task repeats and calendar blocks. */
export type Dow = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TaskId = string;
export type PlaceId = string;
/** IANA zone id, e.g. 'Europe/Berlin'. */
export type Timezone = string;
/** 'YYYY-M-D' in the home zone, as produced by dayKey(). */
export type DayKey = string;

export interface Place {
  id: PlaceId;
  name: string;
  kind: PlaceKind;
  /** Minutes one way from home; 0 = no travel. */
  travel: number;
}

interface TaskCommon {
  id: TaskId;
  stream: Stream;
  title: string;
  /** Shown in the day timeline and toasts. */
  short?: string;
  /**
   * Not exclusive to place-locked work: the seed puts a call at 'anywhere' and
   * gym sessions at 'gym'. Only PlaceTask requires it.
   */
  place?: PlaceId;
}

export interface ClockTask extends TaskCommon {
  rule: 'clock';
  /** Absolute hour today, home zone (23 = 23:00). Rolls to tomorrow once past. */
  at?: number;
  /** OR hours from load, so the demo keeps rolling whenever it is opened. */
  h?: number;
  /** OR a stored instant, set by capture. Wins over both of the above. */
  dueAt?: number;
  /** The zone the setter used. */
  tz?: Timezone;
  who?: Who;
  /** Progress, 0–100. */
  pct?: number;
  /** The deadline lands while the user is asleep. */
  sleep?: boolean;
  /** One-line consequence. */
  note?: string;
  /** Paragraph shown when the row is expanded. */
  notes?: string;
}

export interface PlaceTask extends TaskCommon {
  rule: 'place';
  place: PlaceId;
  /** Hour it goes live. Absent means it has no clock at all. */
  at?: number;
  /** Presence means it repeats weekly on that day. */
  dow?: Dow;
  /** '~45m', '~2h'. */
  est?: string;
  /** '3d' — how long it has been waiting. */
  queued?: string;
}

export interface NoneTask extends TaskCommon {
  rule: 'none';
  sub?: string;
  /** Days since last touched. */
  staleDays?: number;
  /** Times it lost to a deadline. */
  lost?: number;
}

export type Task = ClockTask | PlaceTask | NoneTask;

export const isClockTask = (t: Task): t is ClockTask => t.rule === 'clock';
export const isPlaceTask = (t: Task): t is PlaceTask => t.rule === 'place';
export const isNoneTask = (t: Task): t is NoneTask => t.rule === 'none';

/** A booked hour on the calendar. `t: null` is an unclaimed slot. */
export interface Block {
  t: TaskId | null;
  d: Dow;
  /** Start hour, fractional (18.5 = 18:30). */
  s: number;
  /** End hour, fractional. */
  e: number;
  /** Overrides the task's short title on the block. */
  label?: string;
}

/** A slot the week grid marks as unclaimed for a given stream. */
export interface UnclaimedMark {
  d: Dow;
  at: number;
  stream: Stream;
}

export interface StreamMeta {
  name: Stream;
  rule: StreamRule;
  color: string;
  chipBg: string;
}

export interface Zone {
  id: Timezone;
  label: string;
}

export interface Defaults {
  localStorageKey: string;
  homeTimezone: Timezone;
  weeklyDefenceQuotaHours: number;
  baseDefendedHours: number;
  /** Weekday the seed calendar was authored against, so it can be rotated onto today. */
  authoredToday: Dow;
  focusMinutes: number;
}
