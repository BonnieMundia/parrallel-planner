// @vitest-environment jsdom
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SheetModal } from './SheetModal';

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * These are the bugs unit tests could not see: an animation name silently rewritten by
 * CSS Modules, focus escaping a modal, a timer cancelled by its own effect cleanup.
 */
describe('SheetModal', () => {
  it('renders nothing while closed', () => {
    render(
      <SheetModal open={false} title="Where are you" onClose={() => undefined}>
        <button type="button">Inside</button>
      </SheetModal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog and takes focus', () => {
    render(
      <SheetModal open title="Where are you" onClose={() => undefined}>
        <button type="button">Inside</button>
      </SheetModal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Where are you');
    expect(document.activeElement).toBe(dialog);
  });

  it('applies the sheet animation by name, not a scoped rewrite of it', () => {
    // CSS Modules renames animation-name when it is referenced from a *.module.css
    // file, which silently breaks the slide. It is applied from the token instead.
    render(
      <SheetModal open title="Where are you" onClose={() => undefined}>
        <span>Inside</span>
      </SheetModal>,
    );
    expect(screen.getByRole('dialog').style.animation).toContain('ppSheet');
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <SheetModal open title="Where are you" onClose={onClose}>
        <button type="button">Inside</button>
      </SheetModal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on the scrim but not on the surface', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <SheetModal open title="Where are you" onClose={onClose}>
        <button type="button">Inside</button>
      </SheetModal>,
    );
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    const scrim = container.firstElementChild;
    if (scrim) await userEvent.click(scrim as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps Tab inside the dialog', async () => {
    render(
      <SheetModal open title="Where are you" onClose={() => undefined}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </SheetModal>,
    );
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    last.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(first);

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it('returns focus to whatever opened it', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <SheetModal open={open} title="Where are you" onClose={() => setOpen(false)}>
            <button type="button">Inside</button>
          </SheetModal>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeTruthy();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
