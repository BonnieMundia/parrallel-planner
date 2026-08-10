import styles from './CountdownBar.module.css';

export interface CountdownBarProps {
  /** 0–100. Clamped, so a stale percentage cannot overflow the track. */
  pct: number;
  color: string;
  /** 5 px under a countdown, 6 px under the defended and quota figures. */
  height?: number;
  /** Reaches the screen reader. Omit for a bar that only repeats adjacent text. */
  label?: string;
}

export function CountdownBar({ pct, color, height = 5, label }: CountdownBarProps) {
  const value = Math.max(0, Math.min(100, pct));
  const aria =
    label !== undefined
      ? ({
          role: 'progressbar',
          'aria-valuenow': Math.round(value),
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-label': label,
        } as const)
      : ({ 'aria-hidden': true } as const);

  return (
    <div className={styles.track} style={{ height, borderRadius: height <= 5 ? 3 : 4 }} {...aria}>
      <div
        className={styles.fill}
        style={{ width: `${value}%`, background: color, borderRadius: height <= 5 ? 3 : 4 }}
      />
    </div>
  );
}
