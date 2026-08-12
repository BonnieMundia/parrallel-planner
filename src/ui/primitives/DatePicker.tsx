import { useEffect, useMemo, useRef, useState } from 'react';
import { DOW } from '../../app/clock';
import {
  MONTH_NAMES,
  WEEKDAY_INITIALS,
  formatKey,
  fromKey,
  monthGrid,
  shiftKey,
  stepMonth,
  toKey,
} from '../monthGrid';
import styles from './DatePicker.module.css';

export interface DatePickerProps {
  /** 'YYYY-MM-DD'. */
  value: string;
  onChange: (key: string) => void;
  /** Today, in the home zone — not the host's, which may be a different day. */
  today: string;
  label?: string;
}

/** A century either side is far more than a planner needs and keeps the list short. */
const YEAR_SPAN = 5;

/**
 * A month grid in a popover. Hand-built rather than a date library (CLAUDE.md), and
 * a native <input type="date"> would have been simpler but renders as an opaque OS
 * widget that ignores every design token.
 */
export function DatePicker({ value, onChange, today, label = 'Date' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = fromKey(value) ?? fromKey(today);
  const [view, setView] = useState({
    year: parsed?.year ?? new Date().getFullYear(),
    month: parsed?.month ?? 0,
  });
  const wrap = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Reopening on a different month than the chosen date would hide the selection.
  useEffect(() => {
    if (!open) return;
    const p = fromKey(value);
    if (p) setView({ year: p.year, month: p.month });
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cells = useMemo(() => monthGrid(view.year, view.month), [view]);
  const years = useMemo(() => {
    const base = parsed?.year ?? new Date().getFullYear();
    return Array.from({ length: YEAR_SPAN * 2 + 1 }, (_, i) => base - YEAR_SPAN + i);
  }, [parsed?.year]);

  const pick = (key: string): void => {
    onChange(key);
    setOpen(false);
  };

  /** Arrow keys walk the grid by day and week, which is how a calendar is read. */
  const onGridKey = (e: React.KeyboardEvent): void => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = shiftKey(value || today, step);
    onChange(next);
    const p = fromKey(next);
    if (p) setView({ year: p.year, month: p.month });
    // Keep focus on the day that is now selected.
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    });
  };

  return (
    <div className={styles.wrap} ref={wrap}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`${styles.value} tnum`}>
          {value ? formatKey(value, DOW) : 'Pick a date'}
        </span>
        <span className={styles.caret}>▾</span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Choose a date">
          <div className={styles.head}>
            <button
              type="button"
              className={styles.nav}
              aria-label="Previous month"
              onClick={() => setView((v) => stepMonth(v.year, v.month, -1))}
            >
              ‹
            </button>

            <span className={styles.selects}>
              <select
                className={styles.select}
                aria-label="Month"
                value={view.month}
                onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                className={`${styles.select} tnum`}
                aria-label="Year"
                value={view.year}
                onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </span>

            <button
              type="button"
              className={styles.nav}
              aria-label="Next month"
              onClick={() => setView((v) => stepMonth(v.year, v.month, 1))}
            >
              ›
            </button>
          </div>

          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAY_INITIALS.map((d, i) => (
              <span key={`${d}${i}`} className={styles.weekday}>
                {d}
              </span>
            ))}
          </div>

          <div className={styles.grid} role="grid" ref={gridRef} onKeyDown={onGridKey}>
            {cells.map((c) => {
              const selected = c.key === value;
              const isToday = c.key === today;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={[
                    styles.day,
                    c.inMonth ? '' : styles.outside,
                    selected ? styles.selected : '',
                    isToday && !selected ? styles.today : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => pick(c.key)}
                >
                  <span className="tnum">{c.day}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.foot}>
            <button type="button" className={styles.todayBtn} onClick={() => pick(today)}>
              Today
            </button>
            <button
              type="button"
              className={styles.todayBtn}
              onClick={() => pick(shiftKey(today, 7))}
            >
              Next week
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { toKey };
