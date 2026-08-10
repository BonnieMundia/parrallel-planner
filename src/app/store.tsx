/**
 * One reducer, one context, one timer. Seed tasks are never mutated — every edit is an
 * overlay applied on read, which is what makes undo a deletion from a record.
 *
 * The reducer is pure. Buzzes, toasts and timers live in the action wrappers below it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { Dispatch, ReactNode } from 'react';
import { HOUR_MS, dayKey, startTicking } from './clock';
import type { Clock } from './clock';
import { DEFAULTS } from '../domain/seed';
import { INITIAL_STATE } from '../domain/state';
import type { Notif, PlannerState, Tab } from '../domain/state';
import { byRule, dueOf, findTask, nextActive, proposal } from '../domain/select';
import type { PlaceId, Stream, TaskId } from '../domain/types';
import { isPlaceTask } from '../domain/types';
import { HAPTIC, PALETTE, TIMING } from '../ui/tokens';
import { buzz } from '../ui/haptics';

export type DoneKey = 'clock' | 'place' | 'self';

export interface ToastState {
  title: string;
  sub: string;
  color: string;
}

/** A defended block the user is about to give away, and what it costs. */
export interface Surrender {
  /** 'blk:<day>:<start>' — a block, not a task, can be surrendered twice over. */
  key: string;
  taskId: TaskId | null;
  title: string;
  when: string;
}

export interface AppState extends PlannerState {
  /** The expanded clock row, if any. */
  sel: TaskId | null;
  doneOpen: DoneKey | null;
  toast: ToastState | null;
  toastOut: boolean;
  surrender: Surrender | null;
  now: Date;
}

export type Action =
  | { type: 'tick'; now: Date }
  | { type: 'setTab'; tab: Tab }
  | { type: 'setStream'; stream: Stream | null }
  | { type: 'select'; id: TaskId | null }
  | { type: 'toggleDone'; key: DoneKey }
  | { type: 'complete'; id: TaskId }
  | { type: 'undoDone'; id: TaskId }
  | { type: 'remove'; id: TaskId }
  | { type: 'confirm'; id: TaskId }
  | { type: 'move'; id: TaskId; when: number }
  | { type: 'skipOnce'; id: TaskId; day: string }
  | { type: 'endSeries'; id: TaskId }
  | { type: 'resumeSeries'; id: TaskId }
  | { type: 'goTo'; place: PlaceId }
  | { type: 'push'; notif: Notif }
  | { type: 'toast'; toast: ToastState }
  | { type: 'toastOut' }
  | { type: 'toastGone' }
  | { type: 'setWeek'; wk: number }
  | { type: 'stepWeek'; by: number }
  | { type: 'openSurrender'; surrender: Surrender }
  | { type: 'cancelSurrender' }
  | { type: 'giveAway'; key: string; taskId: TaskId | null };

function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'tick':
      return { ...state, now: action.now };
    case 'setTab':
      return { ...state, tab: action.tab };
    case 'setStream':
      return { ...state, stream: action.stream };
    case 'select':
      return { ...state, sel: action.id };
    case 'toggleDone':
      return { ...state, doneOpen: state.doneOpen === action.key ? null : action.key };
    case 'complete':
      return {
        ...state,
        done: { ...state.done, [action.id]: Date.now() },
        sel: state.sel === action.id ? null : state.sel,
      };
    case 'undoDone':
      return { ...state, done: without(state.done, action.id) };
    case 'remove':
      return {
        ...state,
        removed: [...state.removed, action.id],
        added: state.added.filter((t) => t.id !== action.id),
        sel: state.sel === action.id ? null : state.sel,
      };
    case 'confirm':
      return { ...state, confirmed: { ...state.confirmed, [action.id]: Date.now() } };
    case 'move':
      return { ...state, moved: { ...state.moved, [action.id]: action.when } };
    case 'skipOnce':
      return {
        ...state,
        skips: { ...state.skips, [action.id]: [...(state.skips[action.id] ?? []), action.day] },
      };
    case 'endSeries':
      return { ...state, ended: { ...state.ended, [action.id]: Date.now() } };
    case 'resumeSeries':
      return { ...state, ended: without(state.ended, action.id) };
    case 'goTo':
      return { ...state, here: action.place };
    case 'push':
      return { ...state, notifs: [action.notif, ...state.notifs].slice(0, 14) };
    case 'toast':
      return { ...state, toast: action.toast, toastOut: false };
    case 'toastOut':
      return { ...state, toastOut: true };
    case 'toastGone':
      return { ...state, toast: null, toastOut: false };
    case 'setWeek':
      return { ...state, wk: action.wk };
    // Relative, so two clicks inside one render batch move two weeks, not one.
    case 'stepWeek':
      return { ...state, wk: state.wk + action.by };
    case 'openSurrender':
      return { ...state, surrender: action.surrender };
    case 'cancelSurrender':
      return { ...state, surrender: null };
    case 'giveAway': {
      // The block is marked spent, and the work that lost it carries the tally.
      const owner = action.taskId ?? 'unclaimed';
      return {
        ...state,
        surrender: null,
        losses: {
          ...state.losses,
          [action.key]: 1,
          [owner]: (state.losses[owner] ?? 0) + 1,
        },
      };
    }
  }
}

// --- persistence -----------------------------------------------------------------

/** Only the durable half. Transient UI rehydrates to defaults on load. */
const DURABLE = [
  'tab',
  'here',
  'stream',
  'aScreen',
  'aHere',
  'losses',
  'added',
  'removed',
  'places',
  'notifs',
  'perm',
  'done',
  'skips',
  'ended',
  'moved',
  'confirmed',
] as const satisfies readonly (keyof PlannerState)[];

function serialize(state: AppState): string {
  const out: Record<string, unknown> = {};
  for (const k of DURABLE) out[k] = state[k];
  return JSON.stringify(out);
}

function load(): AppState {
  const base: AppState = {
    ...INITIAL_STATE,
    sel: null,
    doneOpen: null,
    toast: null,
    toastOut: false,
    surrender: null,
    now: new Date(),
  };
  try {
    const raw = localStorage.getItem(DEFAULTS.localStorageKey);
    if (!raw) return base;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null) return base;
    const bag = saved as Record<string, unknown>;
    const merged = { ...base };
    for (const k of DURABLE) {
      if (bag[k] !== undefined) Object.assign(merged, { [k]: bag[k] });
    }
    return merged;
  } catch {
    // Unreadable or unparseable storage is not worth losing the session over.
    return base;
  }
}

// --- context ----------------------------------------------------------------------

export interface Actions {
  setTab: (tab: Tab) => void;
  setStream: (stream: Stream | null) => void;
  select: (id: TaskId | null) => void;
  toggleDone: (key: DoneKey) => void;
  completeTask: (id: TaskId) => void;
  undoDone: (id: TaskId) => void;
  removeTask: (id: TaskId) => void;
  confirmReceipt: (id: TaskId) => void;
  moveTo: (id: TaskId, when: Date) => void;
  keepInPlace: (id: TaskId) => void;
  skipOnce: (id: TaskId) => void;
  endSeries: (id: TaskId) => void;
  resumeSeries: (id: TaskId) => void;
  goTo: (place: PlaceId) => void;
  planTrip: (names: string[], back: string) => void;
  setWeek: (wk: number) => void;
  stepWeek: (by: number) => void;
  openSurrender: (surrender: Surrender) => void;
  cancelSurrender: () => void;
  giveAway: (surrender: Surrender, toTitle: string) => void;
  showToast: (title: string, sub: string, color?: string) => void;
  push: (title: string, body: string, color?: string) => void;
}

interface Store {
  state: AppState;
  clock: Clock;
  actions: Actions;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<Store | null>(null);

export function usePlanner(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('usePlanner must be used inside <PlannerProvider>');
  return store;
}

/** Fixed for the session, so `at` and `h` deadlines never drift as the clock ticks. */
const T0 = new Date();

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  const clock: Clock = useMemo(
    () => ({ t0: T0, now: state.now, tz: DEFAULTS.homeTimezone }),
    [state.now],
  );

  // The state the timer needs, without making the timer depend on every tick.
  const live = useRef(state);
  live.current = state;

  // One timer. Seconds only matter when something is inside an hour.
  useEffect(() => {
    const nearest = (): number => {
      const s = live.current;
      const c: Clock = { t0: T0, now: s.now, tz: DEFAULTS.homeTimezone };
      let soonest = Infinity;
      for (const t of byRule(s, 'clock')) {
        soonest = Math.min(soonest, dueOf(s, c, t).getTime() - Date.now());
      }
      return soonest;
    };
    return startTicking((now) => dispatch({ type: 'tick', now }), nearest);
  }, []);

  // Writes are diffed against the last payload, so an unchanged tick misses storage.
  const saved = useRef<string | null>(null);
  useEffect(() => {
    const payload = serialize(state);
    if (payload === saved.current) return;
    saved.current = payload;
    try {
      localStorage.setItem(DEFAULTS.localStorageKey, payload);
    } catch {
      // Storage full or blocked. The session still works; it just will not survive a reload.
    }
  }, [state]);

  // A toast holds, leaves, and is removed.
  useEffect(() => {
    if (!state.toast) return;
    const out = setTimeout(() => dispatch({ type: 'toastOut' }), TIMING.toastHold);
    const gone = setTimeout(() => dispatch({ type: 'toastGone' }), TIMING.toastGone);
    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, [state.toast]);

  const showToast = useCallback((title: string, sub: string, color: string = PALETTE.contract) => {
    dispatch({ type: 'toast', toast: { title, sub, color } });
  }, []);

  const push = useCallback(
    (title: string, body: string, color: string = PALETTE.contract) => {
      const at = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
      dispatch({
        type: 'push',
        notif: { id: Date.now() + Math.random(), title, body, color, at },
      });
    },
    [],
  );

  const actions: Actions = useMemo(() => {
    const title = (id: TaskId): string => findTask(live.current, id)?.title ?? 'It';
    const short = (id: TaskId): string => {
      const t = findTask(live.current, id);
      return t?.short ?? t?.title ?? 'It';
    };

    return {
      setTab: (tab) => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'setTab', tab });
      },
      setStream: (stream) => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'setStream', stream });
      },
      select: (id) => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'select', id });
      },
      toggleDone: (key) => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'toggleDone', key });
      },
      completeTask: (id) => {
        buzz(HAPTIC.complete);
        dispatch({ type: 'complete', id });
        push('Done', title(id), PALETTE.build);
      },
      undoDone: (id) => {
        buzz(HAPTIC.undo);
        dispatch({ type: 'undoDone', id });
      },
      removeTask: (id) => {
        buzz(HAPTIC.remove);
        dispatch({ type: 'remove', id });
      },
      confirmReceipt: (id) => {
        buzz(HAPTIC.receipt);
        dispatch({ type: 'confirm', id });
        showToast(
          'Receipt confirmed',
          `${short(id)} is acknowledged — whoever set it can see you have it.`,
          PALETTE.build,
        );
      },
      moveTo: (id, when) => {
        buzz(HAPTIC.move);
        dispatch({ type: 'move', id, when: when.getTime() });
        const label = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
        showToast('Moved', `${short(id)} now closes ${label} EAT.`, PALETTE.contract);
      },
      keepInPlace: (id) => {
        buzz(HAPTIC.tap);
        showToast(
          'Left where it is',
          `${short(id)} stays past its time. Nothing was moved.`,
          PALETTE.workshop,
        );
      },
      skipOnce: (id) => {
        const s = live.current;
        const t = findTask(s, id);
        if (!t || !isPlaceTask(t)) return;
        const c: Clock = { t0: T0, now: s.now, tz: DEFAULTS.homeTimezone };
        const next = nextActive(s, c, t);
        if (!next) return;
        buzz(HAPTIC.skipOnce);
        dispatch({ type: 'skipOnce', id, day: dayKey(next, c.tz) });
        const day = next.toDateString().slice(0, 3);
        showToast(
          'Skipped once',
          `${t.title} will not run this ${day}. It comes back next week.`,
          PALETTE.workshop,
        );
      },
      endSeries: (id) => {
        buzz(HAPTIC.endSeries);
        dispatch({ type: 'endSeries', id });
        showToast(
          'Series ended',
          `${title(id)} stops repeating. Resume it from the ended list.`,
          PALETTE.alarm,
        );
      },
      resumeSeries: (id) => {
        buzz(HAPTIC.resume);
        dispatch({ type: 'resumeSeries', id });
        showToast('Series resumed', `${title(id)} repeats weekly again.`, PALETTE.build);
      },
      goTo: (place) => {
        buzz(HAPTIC.undo);
        dispatch({ type: 'goTo', place });
      },
      planTrip: (names, back) => {
        buzz(HAPTIC.complete);
        showToast('Trip planned', `${names.join(' → ')} · back by ${back}.`, PALETTE.workshop);
        push(
          `One trip, ${names.length} stops`,
          `${names.join(' → ')}. Leave now to be back by ${back}.`,
          PALETTE.workshop,
        );
      },
      setWeek: (wk) => {
        buzz(HAPTIC.receipt);
        dispatch({ type: 'setWeek', wk });
      },
      stepWeek: (by) => {
        buzz(HAPTIC.undo);
        dispatch({ type: 'stepWeek', by });
      },
      openSurrender: (surrender) => {
        buzz(HAPTIC.receipt);
        dispatch({ type: 'openSurrender', surrender });
      },
      cancelSurrender: () => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'cancelSurrender' });
      },
      giveAway: (surrender, toTitle) => {
        buzz(HAPTIC.move);
        dispatch({ type: 'giveAway', key: surrender.key, taskId: surrender.taskId });
        if (surrender.taskId !== null) {
          push(
            'Block surrendered',
            `${short(surrender.taskId)} lost ${surrender.when} to ${toTitle}.`,
            PALETTE.alarm,
          );
        }
      },
      showToast,
      push,
    };
  }, [push, showToast]);

  const store = useMemo<Store>(
    () => ({ state, clock, actions, dispatch }),
    [state, clock, actions],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Where a missed deadline honestly goes. Exposed so the past-due band can label it. */
export function proposedSlot(clock: Clock): Date {
  return proposal(clock);
}

export { HOUR_MS };
