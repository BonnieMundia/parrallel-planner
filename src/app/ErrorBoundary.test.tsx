// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('added is not iterable');
}

beforeEach(() => {
  // React logs the caught error; the boundary logs its own. Neither is a test failure.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('ErrorBoundary', () => {
  it('passes children through when nothing throws', () => {
    render(
      <ErrorBoundary>
        <span>Today, laid out</span>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Today, laid out')).toBeTruthy();
  });

  it('shows a recoverable screen instead of a white page', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    // The likeliest cause is unreadable stored state, so that is the offered escape.
    expect(screen.getByRole('button', { name: /clear saved data/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });

  it('surfaces the message, so a crash is reportable', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('added is not iterable')).toBeTruthy();
  });
});
