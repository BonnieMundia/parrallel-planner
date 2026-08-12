import { describe, expect, it } from 'vitest';
import { EMPTY_OVERLAYS, foldEvents } from './foldEvents';
import type { EventKind, TaskEventRow } from './foldEvents';

let seq = 0;
const ev = (
  kind: EventKind,
  task_id: string | null,
  occurred_at: string,
  payload: Record<string, unknown> = {},
): TaskEventRow => ({ id: `e${++seq}`, task_id, kind, payload, occurred_at });

const T = (mins: number): string => new Date(Date.UTC(2026, 7, 12, 9, mins)).toISOString();

describe('foldEvents', () => {
  it('produces empty overlays from an empty log', () => {
    expect(foldEvents([])).toEqual(EMPTY_OVERLAYS);
  });

  it('replays a completion into `done`', () => {
    const out = foldEvents([ev('completed', 'rlhf', T(0))]);
    expect(out.done['rlhf']).toBe(Date.parse(T(0)));
  });

  /**
   * The scenario ADR-001 §4 is built around: complete on the phone while offline,
   * undo on the desktop, reconcile. The later event wins with no merge code.
   */
  it('lets the later write win, whatever order the events arrive in', () => {
    const completed = ev('completed', 'rlhf', T(0));
    const undone = ev('uncompleted', 'rlhf', T(5));

    expect(foldEvents([completed, undone]).done['rlhf']).toBeUndefined();
    // Same log, delivered backwards — same answer.
    expect(foldEvents([undone, completed]).done['rlhf']).toBeUndefined();
  });

  it('re-completes when the completion is the later of the two', () => {
    const out = foldEvents([ev('uncompleted', 'rlhf', T(0)), ev('completed', 'rlhf', T(5))]);
    expect(out.done['rlhf']).toBe(Date.parse(T(5)));
  });

  it('breaks ties on event id, so two devices fold the same log identically', () => {
    const a = { ...ev('completed', 'x', T(0)), id: 'aaa' };
    const b = { ...ev('uncompleted', 'x', T(0)), id: 'bbb' };
    expect(foldEvents([a, b])).toEqual(foldEvents([b, a]));
  });

  it('treats removals as a grow-only set, and restore as its deletion', () => {
    expect(foldEvents([ev('removed', 'sim', T(0)), ev('removed', 'sim', T(1))]).removed).toEqual([
      'sim',
    ]);
    expect(foldEvents([ev('removed', 'sim', T(0)), ev('restored', 'sim', T(2))]).removed).toEqual(
      [],
    );
  });

  it('collects skips per task without duplicating a day', () => {
    const out = foldEvents([
      ev('series_skipped', 'church', T(0), { day_key: '2026-8-16' }),
      ev('series_skipped', 'church', T(1), { day_key: '2026-8-23' }),
      ev('series_skipped', 'church', T(2), { day_key: '2026-8-16' }),
    ]);
    expect(out.skips['church']).toEqual(['2026-8-16', '2026-8-23']);
  });

  it('ends and resumes a series', () => {
    expect(foldEvents([ev('series_ended', 'church', T(0))]).ended['church']).toBeTypeOf('number');
    expect(
      foldEvents([ev('series_ended', 'church', T(0)), ev('series_resumed', 'church', T(1))]).ended[
        'church'
      ],
    ).toBeUndefined();
  });

  it('takes the moved instant from the payload, not the event time', () => {
    const due = Date.UTC(2026, 7, 20, 12, 0);
    expect(foldEvents([ev('moved', 'rlhf', T(0), { due_at: due })]).moved['rlhf']).toBe(due);
  });

  it('accepts a moved instant as an ISO string too', () => {
    const iso = '2026-08-20T12:00:00.000Z';
    expect(foldEvents([ev('moved', 'rlhf', T(0), { due_at: iso })]).moved['rlhf']).toBe(
      Date.parse(iso),
    );
  });

  it('counts every surrender rather than overwriting a tally', () => {
    // Two devices, each surrendering a block offline. A counter would merge to one.
    const out = foldEvents([
      ev('block_surrendered', 'canbus', T(0), { block_key: 'blk:0:6' }),
      ev('block_surrendered', 'canbus', T(1), { block_key: 'blk:3:6' }),
    ]);
    expect(out.surrenders).toHaveLength(2);
    expect(out.surrenders.map((s) => s.blockKey)).toEqual(['blk:0:6', 'blk:3:6']);
  });

  it('ignores events whose payload is missing what they need', () => {
    const out = foldEvents([
      ev('series_skipped', 'church', T(0)),
      ev('block_surrendered', 'canbus', T(1)),
      ev('moved', 'rlhf', T(2), { due_at: 'not a date' }),
    ]);
    expect(out.skips['church']).toBeUndefined();
    expect(out.surrenders).toEqual([]);
    expect(out.moved['rlhf']).toBeUndefined();
  });

  it('is idempotent: folding a log twice gives the same answer', () => {
    const log = [
      ev('completed', 'rlhf', T(0)),
      ev('series_skipped', 'church', T(1), { day_key: '2026-8-16' }),
      ev('block_surrendered', 'canbus', T(2), { block_key: 'blk:0:6' }),
      ev('removed', 'sim', T(3)),
    ];
    expect(foldEvents(log)).toEqual(foldEvents(log));
    // And replaying a duplicate delivery changes nothing that matters.
    const twice = foldEvents([...log, ...log]);
    expect(twice.done).toEqual(foldEvents(log).done);
    expect(twice.skips).toEqual(foldEvents(log).skips);
    expect(twice.removed).toEqual(foldEvents(log).removed);
  });
});
