import { describe, expect, it } from 'vitest';
import { MONTHS } from '../app/clock';
import type { Clock } from '../app/clock';
import { INITIAL_STATE } from './state';
import type { PlannerState } from './state';
import {
  activeLabel,
  byRule,
  clockList,
  countdown,
  dueOf,
  findTask,
  hero,
  hotCount,
  leaveBy,
  lossesOf,
  minsOf,
  monday,
  nextActive,
  noneList,
  phoneNext,
  placeGroups,
  placeName,
  proposal,
  quota,
  rotatedBlocks,
  ruleCounts,
  setByLabel,
  streak,
  theirClock,
  todayIndex,
  travelTo,
  trip,
  weekNumber,
  weekRange,
  weekShift,
} from './select';
import { isClockTask, isPlaceTask } from './types';
import type { ClockTask, PlaceTask } from './types';

const EAT = 'Africa/Nairobi';

/** Thu 7 August 2025, 14:30 EAT. Every expectation below is pinned to it. */
const T0 = new Date('2025-08-07T11:30:00Z');

const clock = (now: Date = T0): Clock => ({ t0: T0, now, tz: EAT });
/** Same load time, a later tick — which is what a real session looks like. */
const after = (hours: number): Clock => clock(new Date(T0.getTime() + hours * 3600_000));

const state = (over: Partial<PlannerState> = {}): PlannerState => ({ ...INITIAL_STATE, ...over });

const ids = (list: readonly { id: string }[]): string[] => list.map((t) => t.id);

const clockTask = (s: PlannerState, id: string): ClockTask => {
  const t = findTask(s, id);
  if (!t || !isClockTask(t)) throw new Error(`${id} is not a clock task`);
  return t;
};
const placeTask = (s: PlannerState, id: string): PlaceTask => {
  const t = findTask(s, id);
  if (!t || !isPlaceTask(t)) throw new Error(`${id} is not a place task`);
  return t;
};

describe('the world with overlays applied', () => {
  it('counts 6 on a clock, 8 on a place, 8 on nothing', () => {
    expect(ruleCounts(state())).toEqual({ clock: 6, place: 8, none: 8 });
  });

  it('drops completed work out of its list', () => {
    const s = state({ done: { rlhf: T0.getTime() } });
    expect(ids(byRule(s, 'clock'))).not.toContain('rlhf');
    expect(ruleCounts(s).clock).toBe(5);
  });

  it('drops an ended series out of its list', () => {
    const s = state({ ended: { church: T0.getTime() } });
    expect(ids(byRule(s, 'place'))).not.toContain('church');
  });

  it('drops removed work and keeps added work', () => {
    const added: PlaceTask = {
      id: 'u1',
      stream: 'Life & errands',
      rule: 'place',
      place: 'market',
      title: 'Pick up the parcel',
    };
    const s = state({ added: [added], removed: ['sim'] });
    expect(ids(byRule(s, 'place'))).toContain('u1');
    expect(ids(byRule(s, 'place'))).not.toContain('sim');
  });

  it('names an unknown place rather than throwing, and assumes 15 minutes out', () => {
    expect(placeName(state(), 'nowhere')).toBe('Somewhere');
    expect(travelTo(state(), 'nowhere')).toBe(15);
    expect(travelTo(state(), 'town')).toBe(25);
    expect(travelTo(state(), 'desk')).toBe(0);
  });
});

describe('dueOf — both ways a deadline is expressed', () => {
  it('reads `at` as an hour today in the home zone', () => {
    expect(dueOf(state(), clock(), clockTask(state(), 'rlhf')).toISOString()).toBe(
      '2025-08-07T20:00:00.000Z',
    );
  });

  it('rolls `at` to tomorrow when the hour is already past at load', () => {
    const late: Clock = { t0: new Date('2025-08-07T21:00:00Z'), now: T0, tz: EAT };
    expect(dueOf(state(), late, clockTask(state(), 'rlhf')).toISOString()).toBe(
      '2025-08-08T20:00:00.000Z',
    );
  });

  it('reads `h` as hours from load, so ch3 is always 26 hours out', () => {
    expect(dueOf(state(), clock(), clockTask(state(), 'ch3')).toISOString()).toBe(
      '2025-08-08T13:30:00.000Z',
    );
  });

  it('does not drift as the session ticks on', () => {
    const t = clockTask(state(), 'ch3');
    expect(dueOf(state(), after(5), t)).toEqual(dueOf(state(), clock(), t));
  });

  it('lets a stored instant win over `at` and `h`', () => {
    const added: ClockTask = {
      id: 'u2',
      stream: 'Contract',
      rule: 'clock',
      title: 'Captured deadline',
      h: 3,
      dueAt: Date.parse('2025-08-09T06:00:00Z'),
    };
    const s = state({ added: [added] });
    expect(dueOf(s, clock(), added).toISOString()).toBe('2025-08-09T06:00:00.000Z');
  });

  it('lets a move win over everything', () => {
    const s = state({ moved: { rlhf: Date.parse('2025-08-07T16:00:00Z') } });
    expect(dueOf(s, clock(), clockTask(s, 'rlhf')).toISOString()).toBe(
      '2025-08-07T16:00:00.000Z',
    );
  });
});

describe('column 1 — locked to a clock, soonest first', () => {
  it('orders every deadline by the instant it lands', () => {
    expect(ids(clockList(state(), clock()))).toEqual([
      'rlhf',
      'call',
      'ch3',
      'cohortb',
      'turnitin',
      'sop',
    ]);
  });

  it('reorders once one is moved', () => {
    const s = state({ moved: { sop: Date.parse('2025-08-07T12:00:00Z') } });
    expect(ids(clockList(s, clock()))[0]).toBe('sop');
  });

  it('floats a picked stream to the top without disturbing order inside it', () => {
    const s = state({ stream: 'Writing' });
    expect(ids(clockList(s, clock()))).toEqual([
      'ch3',
      'turnitin',
      'rlhf',
      'call',
      'cohortb',
      'sop',
    ]);
  });

  it('counts what is inside eight hours', () => {
    // rlhf is 8h30m out at load; nothing is hot yet.
    expect(hotCount(state(), clock())).toBe(0);
    expect(countdown(state(), after(1), clockTask(state(), 'rlhf'))).toEqual({
      v: '7h 30m',
      u: 'left',
      hot: true,
    });
    expect(hotCount(state(), after(1))).toBe(1);
  });

  it('shows the setter their own clock', () => {
    expect(theirClock(state(), clock(), clockTask(state(), 'rlhf'))).toBe('13:00 PDT client');
    expect(theirClock(state(), clock(), clockTask(state(), 'call'))).toBe('09:30 CEST call');
  });

  it('names who set it', () => {
    expect(setByLabel(clockTask(state(), 'rlhf'))).toBe('Set by the client');
    expect(setByLabel(clockTask(state(), 'sop'))).toBe('Portal deadline — no one to ask');
  });

  it('proposes two hours on, or 09:00 tomorrow once the day is spent', () => {
    expect(proposal(clock()).toISOString()).toBe('2025-08-07T13:00:00.000Z');
    expect(proposal(after(7)).toISOString()).toBe('2025-08-08T06:00:00.000Z');
  });
});

describe('nextActive — when place work goes live', () => {
  it('finds the next occurrence of a weekly repeat', () => {
    // Thursday, so Sunday service is three days out.
    expect(nextActive(state(), clock(), placeTask(state(), 'church'))?.toISOString()).toBe(
      '2025-08-10T06:00:00.000Z',
    );
    expect(nextActive(state(), clock(), placeTask(state(), 'barber'))?.toISOString()).toBe(
      '2025-08-09T08:00:00.000Z',
    );
  });

  it('rolls a skipped occurrence forward a week and leaves the series intact', () => {
    const s = state({ skips: { church: ['2025-8-10'] } });
    expect(nextActive(s, clock(), placeTask(s, 'church'))?.toISOString()).toBe(
      '2025-08-17T06:00:00.000Z',
    );
  });

  it('rolls past consecutive skips', () => {
    const s = state({ skips: { church: ['2025-8-10', '2025-8-17'] } });
    expect(nextActive(s, clock(), placeTask(s, 'church'))?.toISOString()).toBe(
      '2025-08-24T06:00:00.000Z',
    );
  });

  it('returns null for an ended series', () => {
    const s = state({ ended: { church: T0.getTime() } });
    expect(nextActive(s, clock(), placeTask(s, 'church'))).toBeNull();
  });

  it('returns null for work with no clock at all', () => {
    expect(nextActive(state(), clock(), placeTask(state(), 'shop'))).toBeNull();
    expect(activeLabel(state(), clock(), placeTask(state(), 'shop'))).toEqual({
      at: 'No set time',
      in: 'whenever you are there',
      hot: false,
    });
  });

  it('labels a timed item with its hour and the gap', () => {
    expect(activeLabel(state(), clock(), placeTask(state(), 'barber'))).toEqual({
      at: '11:00 Sat',
      in: '1 d 20 h from now',
      hot: false,
    });
  });
});

describe('leave-by', () => {
  it('is the occurrence minus the travel to that place', () => {
    expect(leaveBy(state(), clock(), placeTask(state(), 'barber'))?.label).toBe(
      'Leave by 10:35 · 25 min away',
    );
  });

  it('is absent when there is nothing to travel to, or no time to travel by', () => {
    expect(leaveBy(state(), clock(), placeTask(state(), 'shop'))).toBeNull();
  });

  it('turns urgent inside the hour', () => {
    const justBefore = new Date(Date.parse('2025-08-09T08:00:00.000Z') - 80 * 60_000);
    const c: Clock = { t0: T0, now: justBefore, tz: EAT };
    expect(leaveBy(state(), c, placeTask(state(), 'barber'))?.urgent).toBe(true);
  });
});

describe('column 2 — locked to a place', () => {
  it('groups by place, soonest group first, and only lists places holding work', () => {
    const groups = placeGroups(state(), clock());
    expect(groups.map((g) => g.place.id)).toEqual(['town', 'church', 'parents', 'market']);
  });

  it('sinks a place holding only untimed work to the bottom', () => {
    const groups = placeGroups(state(), clock());
    expect(groups[groups.length - 1]?.place.id).toBe('market');
  });

  it('puts timed items before untimed ones inside a group', () => {
    const town = placeGroups(state(), clock()).find((g) => g.place.id === 'town');
    expect(town?.items.map((i) => i.task.id)).toEqual(['barber', 'bank', 'sim']);
  });

  it('lights the place you are standing in and dims the rest', () => {
    const groups = placeGroups(state({ here: 'market' }), clock());
    const market = groups.find((g) => g.place.id === 'market');
    expect(market?.here).toBe(true);
    expect(market?.dim).toBe(false);
    expect(market?.status).toBe('live · 2');
    expect(groups.filter((g) => g.dim).map((g) => g.place.id)).toEqual([
      'town',
      'church',
      'parents',
    ]);
  });

  it('does not move the place you are standing in', () => {
    const groups = placeGroups(state({ here: 'market' }), clock());
    expect(groups.map((g) => g.place.id)).toEqual(['town', 'church', 'parents', 'market']);
  });

  it('stops dimming when context awareness is off', () => {
    const s = state({
      here: 'market',
      settings: { ...INITIAL_STATE.settings, contextAware: false },
    });
    expect(placeGroups(s, clock()).every((g) => !g.dim)).toBe(true);
  });

  it('floats a picked stream to the top of its group', () => {
    const groups = placeGroups(state({ stream: 'Life & errands' }), clock());
    expect(groups.map((g) => g.place.id)).toEqual(['town', 'church', 'parents', 'market']);
  });

  it('builds the meta line from the estimate and the queue age', () => {
    const market = placeGroups(state(), clock()).find((g) => g.place.id === 'market');
    expect(market?.items.map((i) => i.meta)).toEqual(['~45m · queued 2d', '~15m · queued 3d']);
  });

  it('marks the weekly repeats as recurring', () => {
    const church = placeGroups(state(), clock()).find((g) => g.place.id === 'church');
    expect(church?.items.filter((i) => i.recurring).map((i) => i.task.id)).toEqual([
      'church',
      'standup',
    ]);
  });
});

describe('column 3 — locked to nothing, most neglected first', () => {
  it('orders by staleness, not by seed order', () => {
    expect(ids(noneList(state()))).toEqual([
      'bench',
      'firmware',
      'canbus',
      'dash',
      'apps',
      'sync',
      'pull',
      'gym',
    ]);
  });

  it('puts the 19-day bench rig at the top, where the Defended card names it', () => {
    expect(noneList(state())[0]?.staleDays).toBe(19);
  });

  it('holds seed order for a tie', () => {
    const list = ids(noneList(state()));
    expect(list.indexOf('sync')).toBeLessThan(list.indexOf('pull'));
  });

  it('counts seeded losses alongside surrendered blocks', () => {
    expect(lossesOf(state(), 'canbus')).toBe(9);
    expect(lossesOf(state({ losses: { canbus: 2 } }), 'canbus')).toBe(11);
  });
});

describe('the one trip', () => {
  it('takes every untimed errand, nearest stop first', () => {
    const t = trip(state(), clock());
    expect(t.stops.map((s) => s.place.id)).toEqual(['market', 'town']);
    expect(t.on).toBe(true);
  });

  it('leaves out places whose work is already timed', () => {
    const t = trip(state(), clock());
    expect(t.stops.map((s) => s.place.id)).not.toContain('church');
    expect(t.stops.map((s) => s.place.id)).not.toContain('parents');
  });

  it('totals farthest × 2 + 8 min per extra stop + all the work', () => {
    const t = trip(state(), clock());
    // 25 × 2 + 8 + (60 + 55)
    expect(t.mins).toBe(173);
    expect(t.total).toBe('175 min door to door');
  });

  it('renders the stop line and the way back', () => {
    const t = trip(state(), clock());
    expect(t.label).toBe('2 stops, one trip');
    expect(t.stops[0]?.line).toBe('2 items · 60 min there · 12 min out');
    expect(t.backLabel).toBe('Leave now, back by 17:23 · 25 min to the far end');
  });

  it('is not worth offering for a single stop', () => {
    const s = state({ removed: ['bank', 'sim'] });
    expect(trip(s, clock()).on).toBe(false);
  });

  it('parses estimates, and falls back to half an hour', () => {
    expect(minsOf(placeTask(state(), 'shop'))).toBe(45);
    expect(minsOf(placeTask(state(), 'church'))).toBe(120);
    expect(minsOf(placeTask(state(), 'standup'))).toBe(60);
    const bare: PlaceTask = {
      id: 'u3',
      stream: 'Life & errands',
      rule: 'place',
      place: 'town',
      title: 'No estimate',
    };
    expect(minsOf(bare)).toBe(30);
  });
});

describe('the phone hero — the single next thing', () => {
  it('lets standing somewhere win over any clock', () => {
    const h = hero(state(), clock(), 'market');
    expect(h.kicker).toBe('You are here');
    // Both errands there are untimed, so the big number is how many are waiting.
    expect(h.big).toBe('2');
    expect(h.bigNote).toBe('items at Naivas supermarket · no set time');
    expect(h.cta).toBe('Take it');
  });

  it('leads with the hour when the place work is timed', () => {
    const h = hero(state(), clock(), 'town');
    expect(h.kicker).toBe('You are here');
    expect(h.title).toBe('Barber — the usual slot');
    expect(h.big).toBe('11:00');
  });

  it('falls to the soonest deadline once it is actually close', () => {
    const h = hero(state(), after(1), 'desk');
    expect(h.kicker).toBe('Do this now');
    expect(h.title).toBe('RLHF batch #4118 — 40 tasks');
    expect(h.big).toBe('7h 30m');
    expect(h.mins).toBe(90);
  });

  it('defends the unclaimed slot when nothing is pressing', () => {
    // At load the nearest deadline is 8h30m out — outside the window.
    const h = hero(state(), clock(), 'desk');
    expect(h.kicker).toBe('Nothing needs you');
    expect(h.id).toBe('bench');
    expect(h.cta).toBe('Defend it');
    expect(h.mins).toBe(45);
  });
});

describe('what follows the hero', () => {
  it('runs the rest of where you are, then the clock', () => {
    const rows = phoneNext(state(), clock(), 'market');
    expect(ids(rows)).toEqual(['pharmacy', 'rlhf', 'call']);
    expect(rows.every((r) => r.usable)).toBe(true);
  });

  it('runs the clock first when you are nowhere in particular', () => {
    expect(ids(phoneNext(state(), clock(), 'desk'))).toEqual([
      'call',
      'ch3',
      'barber',
      'church',
    ]);
  });

  it('dims place work you are not standing in, and names where it is', () => {
    const rows = phoneNext(state(), clock(), 'desk');
    const barber = rows.find((r) => r.id === 'barber');
    expect(barber?.usable).toBe(false);
    expect(barber?.sub).toBe('Town / CBD · 11:00 Sat');
  });

  it('shows the estimate rather than a countdown for untimed work', () => {
    const rows = phoneNext(state(), clock(), 'market');
    expect(rows.find((r) => r.id === 'pharmacy')?.right).toBe('~15m');
  });
});

describe('streak', () => {
  it('is zero with nothing ticked off', () => {
    expect(streak(state(), clock())).toBe(0);
  });

  it('counts consecutive days back from today', () => {
    const day = 86_400_000;
    const s = state({
      done: {
        a: T0.getTime(),
        b: T0.getTime() - day,
        c: T0.getTime() - 2 * day,
      },
    });
    expect(streak(s, clock())).toBe(3);
  });

  it('does not let an empty today break a streak that is still alive', () => {
    const day = 86_400_000;
    const s = state({ done: { b: T0.getTime() - day, c: T0.getTime() - 2 * day } });
    expect(streak(s, clock())).toBe(2);
  });

  it('breaks on the first gap', () => {
    const day = 86_400_000;
    const s = state({ done: { a: T0.getTime(), c: T0.getTime() - 2 * day } });
    expect(streak(s, clock())).toBe(1);
  });
});

describe('quota', () => {
  it('starts at the base defended hours', () => {
    expect(quota(state())).toEqual({ hours: 3.5, target: 6, pct: 58, label: '3.5 / 6 h' });
  });

  it('only counts a block once the work inside it is ticked off', () => {
    const s = state({ done: { canbus: T0.getTime() } });
    // Three one-hour canbus blocks across the week.
    expect(quota(s).hours).toBe(6.5);
    expect(quota(s).pct).toBe(100);
  });

  it('ignores completed work that was never a defended block', () => {
    expect(quota(state({ done: { rlhf: T0.getTime() } })).hours).toBe(3.5);
  });
});

describe('the week grid', () => {
  it('does not rotate when today is the day the calendar was authored against', () => {
    expect(todayIndex(clock())).toBe(3);
    expect(weekShift(clock())).toBe(0);
  });

  it('rotates floating work onto today', () => {
    const sat: Clock = { t0: new Date('2025-08-09T11:30:00Z'), now: T0, tz: EAT };
    expect(todayIndex(sat)).toBe(5);
    expect(weekShift(sat)).toBe(2);
    const blocks = rotatedBlocks(state(), sat);
    expect(blocks.find((b) => b.t === 'cohortb')?.d).toBe(3);
  });

  it('leaves anything with a real weekday anchored to it', () => {
    const sat: Clock = { t0: new Date('2025-08-09T11:30:00Z'), now: T0, tz: EAT };
    const blocks = rotatedBlocks(state(), sat);
    expect(blocks.find((b) => b.t === 'church')?.d).toBe(6);
    expect(blocks.find((b) => b.t === 'barber')?.d).toBe(5);
    expect(blocks.find((b) => b.t === 'standup')?.d).toBe(2);
  });

  it('finds the Monday of the week being shown', () => {
    const mon = monday(state(), clock());
    expect(mon.getDay()).toBe(1);
    expect(mon.getDate()).toBe(4);
    expect(weekRange(mon, MONTHS)).toBe('4 – 10 August');
    expect(weekNumber(mon)).toBe(32);
  });

  it('steps a week at a time', () => {
    expect(monday(state({ wk: -1 }), clock()).getDate()).toBe(28);
    expect(monday(state({ wk: 1 }), clock()).getDate()).toBe(11);
  });

  it('spells both months when a week straddles them', () => {
    const mon = monday(state({ wk: -1 }), clock());
    expect(weekRange(mon, MONTHS)).toBe('28 July – 3 August');
  });
});
