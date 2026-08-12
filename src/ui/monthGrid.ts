/**
 * Month grid maths for the date picker. Pure, and hand-written rather than pulled
 * from a date library — CLAUDE.md forbids one, and this is about forty lines.
 *
 * Weeks start on Monday, matching DOW and Task.dow (0 = Mon … 6 = Sun) rather than
 * the Sunday-first convention Date.getDay() uses.
 */

export interface DayCell {
  /** 'YYYY-MM-DD', the value the picker reports. */
  key: string;
  day: number;
  month: number;
  year: number;
  /** False for the leading and trailing days borrowed from neighbouring months. */
  inMonth: boolean;
}

export const MONTH_NAMES = [
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

/** Monday first, to match the rest of the app. */
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

const pad = (n: number): string => String(n).padStart(2, '0');

export const toKey = (year: number, month: number, day: number): string =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

/** Parses 'YYYY-MM-DD'. Returns null for anything else, including a real-looking
 *  date that does not exist, so 2026-02-31 cannot slip through. */
export function fromKey(key: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1) return null;
  if (day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one, and it handles leap years.
  return new Date(year, month + 1, 0).getDate();
}

/** 0 = Monday … 6 = Sunday. */
export function mondayIndex(year: number, month: number, day: number): number {
  return (new Date(year, month, day).getDay() + 6) % 7;
}

/**
 * Always six rows of seven. A fixed height stops the popup resizing as you page
 * through months, which is the difference between a calendar and a jumping target.
 */
export function monthGrid(year: number, month: number): DayCell[] {
  const cells: DayCell[] = [];
  const lead = mondayIndex(year, month, 1);
  const total = daysInMonth(year, month);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevTotal = daysInMonth(prevYear, prevMonth);

  for (let i = lead - 1; i >= 0; i--) {
    const day = prevTotal - i;
    cells.push({ key: toKey(prevYear, prevMonth, day), day, month: prevMonth, year: prevYear, inMonth: false });
  }

  for (let day = 1; day <= total; day++) {
    cells.push({ key: toKey(year, month, day), day, month, year, inMonth: true });
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  for (let day = 1; cells.length < 42; day++) {
    cells.push({ key: toKey(nextYear, nextMonth, day), day, month: nextMonth, year: nextYear, inMonth: false });
  }

  return cells;
}

/** Steps a year/month pair, carrying across December and January. */
export function stepMonth(year: number, month: number, by: number): { year: number; month: number } {
  const total = year * 12 + month + by;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** Moves a date key by whole days, which is what the arrow keys need. */
export function shiftKey(key: string, days: number): string {
  const parsed = fromKey(key);
  if (!parsed) return key;
  const d = new Date(parsed.year, parsed.month, parsed.day + days);
  return toKey(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 'Mon 17 Aug 2026' — how a chosen date reads on the button. */
export function formatKey(key: string, weekdays: readonly string[]): string {
  const parsed = fromKey(key);
  if (!parsed) return key;
  const { year, month, day } = parsed;
  const dow = weekdays[mondayIndex(year, month, day)] ?? '';
  return `${dow} ${day} ${MONTH_NAMES[month]?.slice(0, 3) ?? ''} ${year}`;
}
