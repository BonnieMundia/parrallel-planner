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

    const focusable = (): HTMLElement[] => {
      const root = surface.current;
      if (!root) return [];
      // Deliberately not an offsetParent or getClientRects check: both depend on a
      // layout engine, which means the trap silently does nothing under test and is
      // also wrong for anything inside a fixed-position ancestor. The sheet only ever
      // renders its own content, so attributes are enough to decide.
      return [
        ...root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter(
        (el) =>
          !el.hasAttribute('disabled') &&
          !el.hasAttribute('hidden') &&
          el.getAttribute('aria-hidden') !== 'true',
      );
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      // Tab must not walk out of a modal into the page behind it.
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === surface.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
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
