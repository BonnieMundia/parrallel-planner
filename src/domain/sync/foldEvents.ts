/**
 * Folds the append-only event log back into the overlay shape the reducer already
 * holds — ADR-001 §6.5.
 *
 * This is the whole reason sync is tractable here. Every overlay is either a
 * last-write-wins register keyed by task id or a grow-only set, so replaying events
 * in `occurred_at` order converges regardless of the order they arrived in, and
 * `select.ts` never learns any of it happened.
 *
 * Pure, and deliberately free of any Supabase types: it takes plain rows.
 */

import type { PlannerState } from '../state';
import type { TaskId } from '../types';

export type EventKind =
  | 'completed'
  | 'uncompleted'
  | 'removed'
  | 'restored'
  | 'moved'
  | 'receipt_confirmed'
  | 'series_skipped'
  | 'series_ended'
  | 'series_resumed'
  | 'block_surrendered';

export interface TaskEventRow {
  id: string;
  task_id: TaskId | null;
  kind: EventKind;
  payload: Record<string, unknown>;
  /** ISO 8601. The last-write-wins version. */
  occurred_at: string;
}

/** The half of PlannerState that the event log owns. */
export type Overlays = Pick<
  PlannerState,
  'done' | 'removed' | 'skips' | 'ended' | 'moved' | 'confirmed' | 'surrenders'
>;

export const EMPTY_OVERLAYS: Overlays = {
  done: {},
  removed: [],
  skips: {},
  ended: {},
  moved: {},
  confirmed: {},
  surrenders: [],
};

type Mutable<T> = T extends readonly (infer E)[] ? E[] : never;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function foldEvents(events: readonly TaskEventRow[]): Overlays {
  const done: Record<TaskId, number> = {};
  const ended: Record<TaskId, number> = {};
  const moved: Record<TaskId, number> = {};
  const confirmed: Record<TaskId, number> = {};
  const skips: Record<TaskId, string[]> = {};
  const removed = new Set<TaskId>();
  const surrenders: Mutable<Overlays['surrenders']> = [];

  // Ascending, so the last writer for a given key wins — the LWW rule. Ties break on
  // event id, so two devices folding the same log always agree.
  const ordered = [...events].sort((a, b) => {
    const t = Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
    return t !== 0 ? t : a.id.localeCompare(b.id);
  });

  for (const e of ordered) {
    const at = Date.parse(e.occurred_at);
    const id = e.task_id;

    switch (e.kind) {
      case 'completed':
        if (id) done[id] = at;
        break;
      case 'uncompleted':
        if (id) delete done[id];
        break;
      case 'removed':
        if (id) removed.add(id);
        break;
      case 'restored':
        if (id) removed.delete(id);
        break;
      case 'moved': {
        const when = num(e.payload['due_at']) ?? Date.parse(str(e.payload['due_at']) ?? '');
        if (id && Number.isFinite(when)) moved[id] = when;
        break;
      }
      case 'receipt_confirmed':
        if (id) confirmed[id] = at;
        break;
      case 'series_skipped': {
        const day = str(e.payload['day_key']);
        // A set per key: skipping the same day twice must not queue it twice.
        if (id && day && !(skips[id] ??= []).includes(day)) skips[id].push(day);
        break;
      }
      case 'series_ended':
        if (id) ended[id] = at;
        break;
      case 'series_resumed':
        if (id) delete ended[id];
        break;
      case 'block_surrendered': {
        const blockKey = str(e.payload['block_key']);
        // Counted, never overwritten — a counter loses increments on merge (§5.3).
        if (blockKey) surrenders.push({ id: e.id, blockKey, taskId: id, at });
        break;
      }
    }
  }

  return { done, ended, moved, confirmed, skips, removed: [...removed], surrenders };
}
