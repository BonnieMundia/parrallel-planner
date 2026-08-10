import styles from './Tick.module.css';

export interface TickProps {
  onClick: () => void;
  /** Reaches the screen reader; the glyph itself is decorative. */
  label: string;
}

/**
 * Mark done. 19 px of ring, filling green under the pointer — but the hit area is
 * pushed out to 44 px on touch, where the ring alone would be unmissable by a thumb.
 */
export function Tick({ onClick, label }: TickProps) {
  return (
    <button type="button" className={styles.tick} onClick={onClick} title={label}>
      <span className={styles.srOnly}>{label}</span>
      <span aria-hidden="true">✓</span>
    </button>
  );
}
