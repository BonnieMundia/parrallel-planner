import { describe, expect, it, vi } from 'vitest';
import {
  DOW,
  absLabel,
  dayKey,
  fromNow,
  gap,
  hhmm,
  offsetMin,
  padHour,
  parts,
  sameDay,
  startTicking,
  urgency,
  zoneAbbr,
  zoneCity,
  zonedToUTC,
  nextInZone,
} from './clock';
import type { Clock } from './clock';
import { SEED_ZONES } from '../domain/seed';

const EAT = 'Africa/Nairobi';
const BERLIN = 'Europe/Berlin';
const LA = 'America/Los_Angeles';

/** Thu 7 Aug 2025, 14:30 EAT. Fixed so nothing here depends on the host clock. */
const T0 = new Date('2025-08-07T11:30:00Z');
const clock = (now: Date = T0, t0: Date = T0): Clock => ({ t0, now, tz: EAT });

describe('parts', () => {
  it('reads wall clock in the given zone, not the host zone', () => {
    expect(parts(T0, EAT)).toEqual({ dow: 'Thu', y: 2025, mo: 8, d: 7, h: 14, mi: 30 });
    expect(parts(T0, BERLIN)).toEqual({ dow: 'Thu', y: 2025, mo: 8, d: 7, h: 13, mi: 30 });
    expect(parts(T0, LA)).toEqual({ dow: 'Thu', y: 2025, mo: 8, d: 7, h: 4, mi: 30 });
  });

  it('reports midnight as hour 0, not 24', () => {
    expect(parts(new Date('2025-08-06T21:00:00Z'), EAT).h).toBe(0);
  });
});

describe('offsetMin', () => {
  it('measures minutes ahead of UTC', () => {
    expect(offsetMin(EAT, T0)).toBe(180);
    expect(offsetMin(LA, T0)).toBe(-420);
  });

  it('follows the zone across its own DST boundary', () => {
    expect(offsetMin(BERLIN, new Date('2025-01-15T12:00:00Z'))).toBe(60);
    expect(offsetMin(BERLIN, new Date('2025-07-15T12:00:00Z'))).toBe(120);
  });
});

describe('zonedToUTC', () => {
  it('turns a wall-clock reading back into the right instant', () => {
    expect(zonedToUTC(EAT, 2025, 7, 7, 23, 0).toISOString()).toBe('2025-08-07T20:00:00.000Z');
    expect(zonedToUTC(BERLIN, 2025, 7, 7, 9, 0).toISOString()).toBe('2025-08-07T07:00:00.000Z');
  });

  it('lands on the correct side of a spring-forward boundary', () => {
    // 03:00 on the morning Berlin loses an hour: CEST already applies.
    expect(zonedToUTC(BERLIN, 2025, 2, 30, 3, 0).toISOString()).toBe('2025-03-30T01:00:00.000Z');
    expect(zonedToUTC(BERLIN, 2025, 2, 30, 1, 0).toISOString()).toBe('2025-03-30T00:00:00.000Z');
  });

  it('rolls a normalised day past the end of the month', () => {
    expect(zonedToUTC(EAT, 2025, 7, 32, 9, 0).toISOString()).toBe('2025-09-01T06:00:00.000Z');
  });
});

describe('nextInZone', () => {
  it('takes today when the hour is still ahead', () => {
    expect(nextInZone(BERLIN, 20, 0, T0).toISOString()).toBe('2025-08-07T18:00:00.000Z');
  });

  it('rolls to tomorrow once the hour is past', () => {
    expect(nextInZone(BERLIN, 9, 0, T0).toISOString()).toBe('2025-08-08T07:00:00.000Z');
  });
});

describe('zoneAbbr', () => {
  it('uses the curated pair, picking the DST half by date', () => {
    expect(zoneAbbr(BERLIN, new Date('2025-01-15T12:00:00Z'))).toBe('CET');
    expect(zoneAbbr(BERLIN, new Date('2025-07-15T12:00:00Z'))).toBe('CEST');
    expect(zoneAbbr('Europe/London', new Date('2025-07-15T12:00:00Z'))).toBe('BST');
  });

  it('leaves zones without a seasonal change alone', () => {
    expect(zoneAbbr(EAT, T0)).toBe('EAT');
    expect(zoneAbbr('Asia/Dubai', T0)).toBe('GST');
  });

  it('falls back to Intl for anything uncurated', () => {
    expect(zoneAbbr('America/New_York', new Date('2025-07-15T12:00:00Z'))).toBe('EDT');
  });
});

describe('zoneCity', () => {
  it('takes the city half of the seed label', () => {
    expect(zoneCity(BERLIN, SEED_ZONES)).toBe('Berlin');
    expect(zoneCity(LA, SEED_ZONES)).toBe('Los Angeles');
  });

  it('falls back to the zone id for anything unlisted', () => {
    expect(zoneCity('America/Sao_Paulo', SEED_ZONES)).toBe('Sao Paulo');
  });
});

describe('formatting', () => {
  it('pads hours and minutes', () => {
    expect(hhmm(T0, EAT)).toBe('14:30');
    expect(hhmm(T0, LA)).toBe('04:30');
    expect(padHour(18.5)).toBe('18:30');
    expect(padHour(9)).toBe('09:00');
    expect(padHour(17.25)).toBe('17:15');
  });

  it('keys days in the home zone', () => {
    expect(dayKey(T0, EAT)).toBe('2025-8-7');
    // 01:30 EAT on the 8th is still the 7th in Los Angeles.
    expect(dayKey(new Date('2025-08-07T22:30:00Z'), EAT)).toBe('2025-8-8');
    expect(dayKey(new Date('2025-08-07T22:30:00Z'), LA)).toBe('2025-8-7');
  });

  it('says Today only for today', () => {
    expect(sameDay(T0, new Date('2025-08-07T20:00:00Z'), EAT)).toBe(true);
    expect(absLabel(new Date('2025-08-07T20:00:00Z'), clock())).toBe('Today 23:00');
    expect(absLabel(new Date('2025-08-08T20:00:00Z'), clock())).toBe('Fri 23:00');
  });
});

describe('gap — the countdown', () => {
  const at = (ms: number): ReturnType<typeof gap> => gap(new Date(T0.getTime() + ms), T0);

  it('counts days and hours beyond a day out', () => {
    expect(at(26 * 3600_000)).toEqual({ v: '1d 2h', u: 'remaining', hot: false });
  });

  it('counts hours and minutes inside a day', () => {
    expect(at(7 * 3600_000 + 5 * 60_000)).toEqual({ v: '7h 05m', u: 'left', hot: true });
  });

  it('counts minutes and seconds inside the hour', () => {
    expect(at(9 * 60_000 + 41_000)).toEqual({ v: '9m 41s', u: 'left', hot: true });
  });

  it('turns hot at eight hours, not before', () => {
    expect(at(8 * 3600_000).hot).toBe(false);
    expect(at(8 * 3600_000 - 1000).hot).toBe(true);
  });

  it('floors at zero once the time has passed', () => {
    expect(at(-5 * 3600_000)).toEqual({ v: '0m 00s', u: 'left', hot: true });
  });
});

describe('fromNow', () => {
  const at = (ms: number): string => fromNow(new Date(T0.getTime() + ms), T0);

  it('spells the gap out for place work', () => {
    expect(at(50 * 3600_000)).toBe('2 d 2 h from now');
    expect(at(3 * 3600_000 + 7 * 60_000)).toBe('3 h 07 m from now');
    expect(at(25 * 60_000)).toBe('25 min from now');
  });
});

describe('urgency tiers', () => {
  const tier = (ms: number): number => urgency(new Date(T0.getTime() + ms), T0);

  it('is 0 beyond eight hours', () => {
    expect(tier(9 * 3600_000)).toBe(0);
    expect(tier(8 * 3600_000)).toBe(0);
  });

  it('is 1 inside eight hours', () => {
    expect(tier(8 * 3600_000 - 1)).toBe(1);
    expect(tier(3600_000)).toBe(1);
  });

  it('is 2 inside the hour', () => {
    expect(tier(3600_000 - 1)).toBe(2);
    expect(tier(1)).toBe(2);
  });

  it('is 3 once past, including exactly on time', () => {
    expect(tier(0)).toBe(3);
    expect(tier(-1)).toBe(3);
  });
});

describe('DOW', () => {
  it('runs Monday to Sunday, matching Task.dow', () => {
    expect(DOW).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(DOW.indexOf('Sun')).toBe(6);
  });
});

describe('startTicking', () => {
  it('ticks every second when something is inside the hour', () => {
    vi.useFakeTimers();
    const ticks: Date[] = [];
    const stop = startTicking((n) => ticks.push(n), () => 30 * 60_000);
    vi.advanceTimersByTime(3000);
    expect(ticks).toHaveLength(3);
    stop();
    vi.useRealTimers();
  });

  it('drops to 20 s when nothing is close, and re-picks the rate after each tick', () => {
    vi.useFakeTimers();
    let nearest = 9 * 3600_000;
    const ticks: Date[] = [];
    const stop = startTicking((n) => ticks.push(n), () => nearest);

    vi.advanceTimersByTime(19_000);
    expect(ticks).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(ticks).toHaveLength(1);

    // A deadline crossing into the hour does not shorten the timer already running —
    // the rate is picked when the next one is scheduled.
    nearest = 60_000;
    vi.advanceTimersByTime(1000);
    expect(ticks).toHaveLength(1);
    vi.advanceTimersByTime(19_000);
    expect(ticks).toHaveLength(2);

    // From here it is ticking every second.
    vi.advanceTimersByTime(1000);
    expect(ticks).toHaveLength(3);
    stop();
    vi.useRealTimers();
  });

  it('stops when told to', () => {
    vi.useFakeTimers();
    const ticks: Date[] = [];
    const stop = startTicking((n) => ticks.push(n), () => 0);
    vi.advanceTimersByTime(1000);
    stop();
    vi.advanceTimersByTime(10_000);
    expect(ticks).toHaveLength(1);
    vi.useRealTimers();
  });
});
