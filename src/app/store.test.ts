import { describe, expect, it } from 'vitest';
import { reducer } from './store';
import type { AppState } from './store';
import { INITIAL_STATE } from '../domain/state';
import { byRule } from '../domain/select';

const base: AppState = {
  ...INITIAL_STATE,
  sel: null,
  doneOpen: null,
  toast: null,
  toastOut: false,
  surrender: null,
  now: new Date('2025-08-07T11:30:00Z'),
};

describe('the reducer never mutates the seed', () => {
  it('records a completion as an overlay, and undo is its deletion', () => {
    const done = reducer(base, { type: 'complete', id: 'rlhf' });
    expect(done.done['rlhf']).toBeTypeOf('number');
    expect(byRule(done, 'clock').map((t) => t.id)).not.toContain('rlhf');

    const undone = reducer(done, { type: 'undoDone', id: 'rlhf' });
    expect('rlhf' in undone.done).toBe(false);
    expect(byRule(undone, 'clock').map((t) => t.id)).toContain('rlhf');
  });

  it('closes the expanded row when that row is completed or removed', () => {
    const open: AppState = { ...base, sel: 'rlhf' };
    expect(reducer(open, { type: 'complete', id: 'rlhf' }).sel).toBeNull();
    expect(reducer(open, { type: 'remove', id: 'rlhf' }).sel).toBeNull();
    expect(reducer(open, { type: 'complete', id: 'ch3' }).sel).toBe('rlhf');
  });

  it('leaves a different row expanded', () => {
    const open: AppState = { ...base, sel: 'ch3' };
    expect(reducer(open, { type: 'remove', id: 'rlhf' }).sel).toBe('ch3');
  });

  it('collects skips per task without disturbing the series', () => {
    const once = reducer(base, { type: 'skipOnce', id: 'church', day: '2025-8-10' });
    const twice = reducer(once, { type: 'skipOnce', id: 'church', day: '2025-8-17' });
    expect(twice.skips['church']).toEqual(['2025-8-10', '2025-8-17']);
    expect(byRule(twice, 'place').map((t) => t.id)).toContain('church');
  });

  it('takes an ended series out of the list and resume puts it back', () => {
    const ended = reducer(base, { type: 'endSeries', id: 'church' });
    expect(byRule(ended, 'place').map((t) => t.id)).not.toContain('church');
    const resumed = reducer(ended, { type: 'resumeSeries', id: 'church' });
    expect(byRule(resumed, 'place').map((t) => t.id)).toContain('church');
  });

  it('drops a removed task from added as well as filtering the seed', () => {
    const withAdded: AppState = {
      ...base,
      added: [{ id: 'u1', stream: 'Contract', rule: 'none', title: 'Mine' }],
    };
    const gone = reducer(withAdded, { type: 'remove', id: 'u1' });
    expect(gone.added).toEqual([]);
    expect(gone.removed).toContain('u1');
  });
});

describe('transient state', () => {
  it('toggles the done collapsible closed when it is already open', () => {
    const open = reducer(base, { type: 'toggleDone', key: 'clock' });
    expect(open.doneOpen).toBe('clock');
    expect(reducer(open, { type: 'toggleDone', key: 'clock' }).doneOpen).toBeNull();
    expect(reducer(open, { type: 'toggleDone', key: 'place' }).doneOpen).toBe('place');
  });

  it('runs a toast in, out, and away', () => {
    const shown = reducer(base, {
      type: 'toast',
      toast: { title: 'Moved', sub: 'x', color: 'var(--contract)' },
    });
    expect(shown.toast?.title).toBe('Moved');
    expect(shown.toastOut).toBe(false);
    expect(reducer(shown, { type: 'toastOut' }).toastOut).toBe(true);
    expect(reducer(shown, { type: 'toastGone' }).toast).toBeNull();
  });

  it('steps the week relative to the state, not to a captured render', () => {
    // Two clicks inside one render batch must move two weeks.
    const twice = reducer(reducer(base, { type: 'stepWeek', by: -1 }), {
      type: 'stepWeek',
      by: -1,
    });
    expect(twice.wk).toBe(-2);
    expect(reducer(twice, { type: 'setWeek', wk: 0 }).wk).toBe(0);
  });

  it('keeps the last 14 notifications', () => {
    let s = base;
    for (let i = 0; i < 20; i++) {
      s = reducer(s, {
        type: 'push',
        notif: { id: i, title: `n${i}`, body: '', color: '', at: '00:00' },
      });
    }
    expect(s.notifs).toHaveLength(14);
    expect(s.notifs[0]?.title).toBe('n19');
  });
});
