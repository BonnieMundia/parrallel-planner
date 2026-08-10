/**
 * Time math and countdown formatting. Everything on screen is home-zone wall clock,
 * whatever machine this runs on, so no function here reads the host timezone — the
 * zone always arrives as an argument. Pure: no React, no module-level `now`.
 */

import type { Timezone, Zone } from '../domain/types';

export interface Clock {
  /** App load time. Fixed for the session so `at` and `h` deadlines never drift. */
  readonly t0: Date;
  /** The current tick. */
  readonly now: Date;
  /** Home zone — the one every clock on screen is shown in. */
  readonly tz: Timezone;
}

/** 0 = Mon … 6 = Sun, matching Task.dow and Block.d. */
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export interface Parts {
  /** 'Mon' … 'Sun'. */
  dow: string;
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}

const FORMATTERS = new Map<Timezone, Intl.DateTimeFormat>();

// One formatter per zone — parts() runs for every task on every tick.
function formatter(tz: Timezone): Intl.DateTimeFormat {
  let f = FORMATTERS.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    FORMATTERS.set(tz, f);
  }
  return f;
}

export function parts(d: Date, tz: Timezone): Parts {
  const bag: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(d)) bag[p.type] = p.value;
  const hour = bag['hour'] ?? '0';
  return {
    dow: bag['weekday'] ?? '',
    y: Number(bag['year']),
    mo: Number(bag['month']),
    d: Number(bag['day']),
    // en-GB reports midnight as 24 under hour12:false.
    h: Number(hour === '24' ? '0' : hour),
    mi: Number(bag['minute']),
  };
}

/** Minutes that `tz` is ahead of UTC at the given instant. */
export function offsetMin(tz: Timezone, d: Date): number {
  const p = parts(d, tz);
  return (
    (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(d.getTime() / 60000) * 60000) / 60000
  );
}

/**
 * A wall-clock reading in `tz` back to an instant. Two passes, because the offset
 * that applies depends on the instant you are still solving for — one pass lands on
 * the wrong side of a DST boundary.
 */
export function zonedToUTC(
  tz: Timezone,
  y: number,
  mo: number,
  day: number,
  h: number,
  mi: number,
): Date {
  const guess = Date.UTC(y, mo, day, h, mi);
  let off = offsetMin(tz, new Date(guess));
  off = offsetMin(tz, new Date(guess - off * 60000));
  return new Date(guess - off * 60000);
}

/** The next time it is h:mi in `tz`, counting from `from`. */
export function nextInZone(tz: Timezone, h: number, mi: number, from: Date): Date {
  const p = parts(from, tz);
  const d = zonedToUTC(tz, p.y, p.mo - 1, p.d, h, mi);
  return d <= from ? zonedToUTC(tz, p.y, p.mo - 1, p.d + 1, h, mi) : d;
}

// Intl only returns letter abbreviations for US zones, so the rest are curated.
const ABBR: Record<string, readonly [string, string]> = {
  'Africa/Nairobi': ['EAT', 'EAT'],
  'Europe/London': ['GMT', 'BST'],
  'Europe/Berlin': ['CET', 'CEST'],
  'Asia/Dubai': ['GST', 'GST'],
  'Asia/Kolkata': ['IST', 'IST'],
  'Asia/Singapore': ['SGT', 'SGT'],
  'Australia/Sydney': ['AEST', 'AEDT'],
};

export function zoneAbbr(tz: Timezone, d: Date): string {
  const pair = ABBR[tz];
  if (pair) {
    const jan = offsetMin(tz, new Date(Date.UTC(d.getUTCFullYear(), 0, 15)));
    const jul = offsetMin(tz, new Date(Date.UTC(d.getUTCFullYear(), 6, 15)));
    const dst = offsetMin(tz, d) > Math.min(jan, jul);
    return pair[dst && jan !== jul ? 1 : 0];
  }
  try {
    const x = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName');
    return x ? x.value : '';
  } catch {
    return '';
  }
}

export function zoneCity(tz: Timezone, zones: readonly Zone[]): string {
  const z = zones.find((x) => x.id === tz);
  if (z) return z.label.split(' — ')[0] ?? tz;
  return (tz || '').split('/').pop()?.replace(/_/g, ' ') ?? '';
}

const two = (n: number): string => String(n).padStart(2, '0');

export function hhmm(d: Date, tz: Timezone): string {
  const p = parts(d, tz);
  return `${two(p.h)}:${two(p.mi)}`;
}

export function dayName(d: Date, tz: Timezone): string {
  return parts(d, tz).dow;
}

/** 'YYYY-M-D' in the home zone. The key skips and completions are recorded against. */
export function dayKey(d: Date, tz: Timezone): string {
  const p = parts(d, tz);
  return `${p.y}-${p.mo}-${p.d}`;
}

/** A fractional hour (18.5) as a wall-clock string ('18:30'). */
export function padHour(x: number): string {
  const h = Math.floor(x);
  return `${two(h)}:${two(Math.round((x - h) * 60))}`;
}

export function sameDay(a: Date, b: Date, tz: Timezone): boolean {
  const x = parts(a, tz);
  const y = parts(b, tz);
  return x.y === y.y && x.mo === y.mo && x.d === y.d;
}

export function absLabel(d: Date, clock: Clock): string {
  const prefix = sameDay(d, clock.now, clock.tz) ? 'Today' : dayName(d, clock.tz);
  return `${prefix} ${hhmm(d, clock.tz)}`;
}

export interface Gap {
  /** The countdown itself, e.g. '2d 3h', '7h 05m', '9m 41s'. */
  v: string;
  u: 'remaining' | 'left';
  /** Inside eight hours. Turns the countdown red. */
  hot: boolean;
}

export function gap(d: Date, now: Date): Gap {
  const s = Math.max(0, Math.floor((d.getTime() - now.getTime()) / 1000));
  const dd = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (dd > 0) return { v: `${dd}d ${h}h`, u: 'remaining', hot: false };
  if (h > 0) return { v: `${h}h ${two(m)}m`, u: 'left', hot: h < 8 };
  return { v: `${m}m ${two(ss)}s`, u: 'left', hot: true };
}

export function fromNow(d: Date, now: Date): string {
  const s = Math.max(0, Math.floor((d.getTime() - now.getTime()) / 1000));
  const dd = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (dd > 0) return `${dd} d ${h} h from now`;
  if (h > 0) return `${h} h ${two(m)} m from now`;
  return `${m} min from now`;
}

/** 0 calm · 1 inside eight hours · 2 inside the hour · 3 past. */
export type Urgency = 0 | 1 | 2 | 3;

export function urgency(due: Date, now: Date): Urgency {
  const ms = due.getTime() - now.getTime();
  if (ms <= 0) return 3;
  if (ms < HOUR_MS) return 2;
  return ms < 8 * HOUR_MS ? 1 : 0;
}

/**
 * One timer, not one per task. Seconds only matter when something is inside an hour,
 * so the interval is chosen from the nearest deadline and re-chosen after every tick.
 * Returns the stop function.
 */
export function startTicking(
  onTick: (now: Date) => void,
  nearestMs: () => number,
  schedule: typeof setTimeout = setTimeout,
  cancel: typeof clearTimeout = clearTimeout,
): () => void {
  let handle: ReturnType<typeof setTimeout>;
  const run = (): void => {
    handle = schedule(() => {
      onTick(new Date());
      run();
    }, nearestMs() < HOUR_MS ? 1000 : 20_000);
  };
  run();
  return () => cancel(handle);
}
