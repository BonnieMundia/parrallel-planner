import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export interface PillProps {
  children: ReactNode;
  /** Colour of the leading dot. Omit for a pill without one. */
  dot?: string;
  background?: string;
  color?: string;
  /** Renders as a button when given a handler. */
  onClick?: () => void;
  title?: string;
}

/** The place chip, the Weekly chip, the stream chips — same shape, different colour. */
export function Pill({ children, dot, background, color, onClick, title }: PillProps) {
  const style = {
    ...(background !== undefined ? { background } : {}),
    ...(color !== undefined ? { color } : {}),
  };
  const content = (
    <>
      {dot !== undefined && <span className={styles.dot} style={{ background: dot }} />}
      {children}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`${styles.pill} ${styles.button}`}
        style={style}
        onClick={onClick}
        {...(title !== undefined ? { title } : {})}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={styles.pill} style={style} {...(title !== undefined ? { title } : {})}>
      {content}
    </span>
  );
}
