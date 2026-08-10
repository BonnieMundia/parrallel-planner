import type { CSSProperties, ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: ReactNode;
  /** Overrides the frosted default — the trip bundle and the defended card are tinted. */
  tint?: string;
  border?: string;
  /** Lifts on hover. Off for cards that are not themselves a target. */
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * The frosted surface everything sits on. Rows inside are separated by hairlines, so
 * the card clips its own corners rather than each row rounding them.
 */
export function Card({ children, tint, border, interactive = false, className, style }: CardProps) {
  return (
    <div
      className={[styles.card, interactive ? styles.interactive : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={{
        ...(tint !== undefined ? { background: tint } : {}),
        ...(border !== undefined ? { borderColor: border } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
