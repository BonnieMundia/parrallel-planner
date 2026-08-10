import styles from './Toast.module.css';
import { ANIM, INK } from '../tokens';

export interface ToastProps {
  title: string;
  sub: string;
  /** Colour of the leading dot, by event type. */
  color?: string;
  /** True once it has started leaving. */
  out?: boolean;
  /** Top right on desktop, above the tab bar on phone — as the prototype places it. */
  placement?: 'desktop' | 'phone';
}

export function Toast({ title, sub, color = INK.link, out = false, placement = 'desktop' }: ToastProps) {
  return (
    <div
      className={`${styles.toast} ${placement === 'phone' ? styles.phone : styles.desktop}`}
      style={{ animation: out ? ANIM.toastOut : ANIM.toastIn }}
      role="status"
      aria-live="polite"
    >
      <span className={styles.dot} style={{ background: color }} />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.sub}>{sub}</span>
      </span>
    </div>
  );
}
