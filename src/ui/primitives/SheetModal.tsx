import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './SheetModal.module.css';
import { ANIM } from '../tokens';

export interface SheetModalProps {
  open: boolean;
  /** The line above the content — 'Where are you', 'Capture'. */
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Off when rows run edge to edge, as in the place picker. */
  padded?: boolean;
}

/** Slides up over a blurred scrim. Escape and the scrim both close it. */
export function SheetModal({ open, title, onClose, children, padded = true }: SheetModalProps) {
  const surface = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement;
    surface.current?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (restoreTo.current instanceof HTMLElement) restoreTo.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.scrim}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={surface}
        className={styles.surface}
        style={{ animation: ANIM.sheet }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className={styles.grab} />
        <div className={styles.title}>{title}</div>
        <div className={padded ? styles.bodyPadded : styles.body}>{children}</div>
      </div>
    </div>
  );
}
