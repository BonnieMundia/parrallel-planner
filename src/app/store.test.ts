import { describe, expect, it } from 'vitest';
import { EMPTY_DRAFT, reducer } from './store';
import type { AppState } from './store';
import { INITIAL_STATE } from '../domain/state';
import { byRule, lossesOf, places } from '../domain/select';

const base: AppState = {
  ...INITIAL_STATE,
  sel: null,
  doneOpen: null,
  toast: null,
  toastOut: false,
  surrender: null,
  captureOpen: false,
  pickerOpen: false,
  notifOpen: false,
  draft: EMPTY_DRAFT,
  newPlace: '',
  focus: null,
  flash: null,
  greet: null,
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

describe('capture', () => {
  it('drops a captured task into added, closes, and clears the title', () => {
    const open = reducer(base, { type: 'setCapture', open: true });
    const typed = reducer(open, { type: 'setDraft', patch: { title: 'Pick up the parcel' } });
    expect(typed.draft.title).toBe('Pick up the parcel');

    const saved = reducer(typed, {
      type: 'addTask',
      task: {
        id: 'u1',
        stream: 'Life & errands',
        rule: 'place',
        place: 'market',
        title: 'Pick up the parcel',
      },
    });
    expect(saved.captureOpen).toBe(false);
    expect(saved.draft.title).toBe('');
    expect(byRule(saved, 'place').map((t) => t.id)).toContain('u1');
  });

  it('abandons the draft title when the sheet is closed unsaved', () => {
    const typed = reducer(reducer(base, { type: 'setCapture', open: true }), {
      type: 'setDraft',
      patch: { title: 'Half-written' },
    });
    expect(reducer(typed, { type: 'setCapture', open: false }).draft.title).toBe('');
  });

  it('keeps the rest of the draft, so the rule survives a reopen', () => {
    const s = reducer(base, { type: 'setDraft', patch: { rule: 'clock', tz: 'Europe/Berlin' } });
    const closed = reducer(s, { type: 'setCapture', open: false });
    expect(closed.draft.rule).toBe('clock');
    expect(closed.draft.tz).toBe('Europe/Berlin');
  });
});

describe('places', () => {
  it('switches to a new place on both layouts as soon as it is added', () => {
    const s = reducer(base, {
      type: 'addPlace',
      place: { id: 'p1', name: 'The library', kind: 'Yours', travel: 15 },
    });
    expect(s.here).toBe('p1');
    expect(s.aHere).toBe('p1');
    expect(s.pickerOpen).toBe(false);
    expect(s.newPlace).toBe('');
    expect(places(s).map((p) => p.id)).toContain('p1');
  });
});

describe('the focus block', () => {
  const started = reducer(base, { type: 'startFocus', id: 'rlhf', mins: 90 });

  it('opens with the whole block in seconds', () => {
    expect(started.focus).toEqual({ id: 'rlhf', mins: 90, left: 5400, paused: false, done: false });
  });

  it('counts down a second at a time', () => {
    expect(reducer(started, { type: 'focusTick' }).focus?.left).toBe(5399);
  });

  it('does not run while paused', () => {
    const paused = reducer(started, { type: 'focusPause' });
    expect(paused.focus?.paused).toBe(true);
    expect(reducer(paused, { type: 'focusTick' }).focus?.left).toBe(5400);
    expect(reducer(paused, { type: 'focusPause' }).focus?.paused).toBe(false);
  });

  it('finishes rather than going negative', () => {
    const nearlyDone: AppState = { ...base, focus: { id: 'rlhf', mins: 90, left: 1, paused: false, done: false } };
    const finished = reducer(nearlyDone, { type: 'focusTick' });
    expect(finished.focus).toEqual({ id: 'rlhf', mins: 90, left: 0, paused: false, done: true });
    // And stays finished — no further ticks drive it below zero.
    expect(reducer(finished, { type: 'focusTick' }).focus?.left).toBe(0);
  });

  it('clears on stop', () => {
    expect(reducer(started, { type: 'focusStop' }).focus).toBeNull();
  });
});

describe('surrenders are rows, not a counter', () => {
  it('keeps both when the same task loses two blocks', () => {
    const once = reducer(base, {
      type: 'giveAway',
      id: 'e1',
      blockKey: 'blk:0:6',
      taskId: 'canbus',
    });
    const twice = reducer(once, {
      type: 'giveAway',
      id: 'e2',
      blockKey: 'blk:1:6',
      taskId: 'canbus',
    });
    expect(twice.surrenders).toHaveLength(2);
    expect(lossesOf(twice, 'canbus')).toBe(11);
    expect(twice.surrender).toBeNull();
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

  it('runs the welcome in, out, and away', () => {
    const showing: AppState = { ...base, greet: 'in' };
    expect(reducer(showing, { type: 'greet', phase: 'out' }).greet).toBe('out');
    expect(reducer(showing, { type: 'greet', phase: null }).greet).toBeNull();
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
