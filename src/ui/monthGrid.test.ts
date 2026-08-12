import { describe, expect, it } from 'vitest';
import {
  daysInMonth,
  formatKey,
  fromKey,
  mondayIndex,
  monthGrid,
  shiftKey,
  stepMonth,
  toKey,
} from './monthGrid';
import { DOW } from '../app/clock';

describe('daysInMonth', () => {
  it('knows the ordinary months', () => {
    expect(daysInMonth(2026, 0)).toBe(31);
    expect(daysInMonth(2026, 3)).toBe(30);
  });

  it('knows February, including leap years and the century rule', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(1900, 1)).toBe(28);
    expect(daysInMonth(2000, 1)).toBe(29);
  });
});

describe('mondayIndex', () => {
  it('counts from Monday, not Sunday', () => {
    // 17 August 2026 is a Monday — the interview date.
    expect(mondayIndex(2026, 7, 17)).toBe(0);
    expect(mondayIndex(2026, 7, 23)).toBe(6); // Sunday
  });
});

describe('fromKey', () => {
  it('round-trips a valid key', () => {
    expect(fromKey('2026-08-17')).toEqual({ year: 2026, month: 7, day: 17 });
    expect(toKey(2026, 7, 17)).toBe('2026-08-17');
  });

  it('rejects malformed input', () => {
    for (const bad of ['', '2026-8-17', 'tomorrow', '2026-13-01', '2026-00-10']) {
      expect(fromKey(bad), bad).toBeNull();
    }
  });

  it('rejects a date that does not exist', () => {
    // The reason this is not just a regex: 31 February parses but is not a day.
    expect(fromKey('2026-02-31')).toBeNull();
    expect(fromKey('2026-02-29')).toBeNull();
    expect(fromKey('2024-02-29')).not.toBeNull();
  });
});

describe('monthGrid', () => {
  it('is always six rows of seven, so the popup never resizes', () => {
    for (const [y, m] of [
      [2026, 7],
      [2026, 1],
      [2021, 1],
      [2026, 10],
    ] as const) {
      expect(monthGrid(y, m), `${y}-${m}`).toHaveLength(42);
    }
  });

  it('starts on a Monday', () => {
    const grid = monthGrid(2026, 7);
    const first = grid[0];
    expect(mondayIndex(first!.year, first!.month, first!.day)).toBe(0);
  });

  it('holds every day of the month exactly once', () => {
    const grid = monthGrid(2026, 7);
    const inMonth = grid.filter((c) => c.inMonth).map((c) => c.day);
    expect(inMonth).toHaveLength(31);
    expect(new Set(inMonth).size).toBe(31);
    expect(inMonth[0]).toBe(1);
    expect(inMonth[30]).toBe(31);
  });

  it('borrows the surrounding days rather than leaving blanks', () => {
    // August 2026 starts on a Saturday, so five July days lead it in.
    const grid = monthGrid(2026, 7);
    expect(grid[0]?.key).toBe('2026-07-27');
    expect(grid.filter((c) => !c.inMonth && c.month === 6)).toHaveLength(5);
  });

  it('carries the year across a December boundary', () => {
    const grid = monthGrid(2026, 11);
    expect(grid.some((c) => c.year === 2027 && c.month === 0)).toBe(true);
    const jan = monthGrid(2027, 0);
    expect(jan.some((c) => c.year === 2026 && c.month === 11)).toBe(true);
  });
});

describe('stepMonth', () => {
  it('steps within a year', () => {
    expect(stepMonth(2026, 7, 1)).toEqual({ year: 2026, month: 8 });
    expect(stepMonth(2026, 7, -1)).toEqual({ year: 2026, month: 6 });
  });

  it('carries across December and January', () => {
    expect(stepMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(stepMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('handles a jump of more than a year', () => {
    expect(stepMonth(2026, 0, 25)).toEqual({ year: 2028, month: 1 });
    expect(stepMonth(2026, 0, -13)).toEqual({ year: 2024, month: 11 });
  });
});

describe('shiftKey', () => {
  it('moves by whole days, which is what the arrow keys need', () => {
    expect(shiftKey('2026-08-17', 1)).toBe('2026-08-18');
    expect(shiftKey('2026-08-17', -7)).toBe('2026-08-10');
  });

  it('crosses month and year boundaries', () => {
    expect(shiftKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftKey('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('crosses a leap day correctly', () => {
    expect(shiftKey('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftKey('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('formatKey', () => {
  it('reads as a date a person would say', () => {
    expect(formatKey('2026-08-17', DOW)).toBe('Mon 17 Aug 2026');
    expect(formatKey('2026-12-25', DOW)).toBe('Fri 25 Dec 2026');
  });
});
