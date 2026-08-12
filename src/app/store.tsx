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
import { HOUR_MS, dayKey, hhmm, nextInZone, startTicking, zoneCity } from './clock';
import type { Clock } from './clock';
import { DEFAULTS, SEED_ZONES } from '../domain/seed';
import { INITIAL_STATE } from '../domain/state';
import type {
  Draft,
  Focus,
  Notif,
  PhoneScreen,
  PlannerState,
  Settings,
  Tab,
} from '../domain/state';
import { byRule, dueOf, findTask, nextActive, placeName, proposal } from '../domain/select';
import type { Place, PlaceId, Stream, Task, TaskId } from '../domain/types';
import { isPlaceTask } from '../domain/types';
import { HAPTIC, INK, PALETTE, TIMING } from '../ui/tokens';
import { buzz } from '../ui/haptics';

/**
 * Ids must be unique across devices, not just within one. 'u' + Date.now() collides
 * when two devices capture in the same millisecond — see ADR-001 §5.2.
 *
 * randomUUID is secure-context only, so it is absent over plain http on a LAN address —
 * which is exactly how you would show someone the app from your laptop. Falling back to
 * random bytes keeps capture working there instead of throwing.
 */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
    b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
    const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

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

export const EMPTY_DRAFT: Draft = {
  title: '',
  rule: 'place',
  stream: 'Life & errands',
  place: 'market',
  time: '15:00',
  tz: 'Africa/Nairobi',
  repeat: 'once',
  dow: 6,
};

export interface AppState extends PlannerState {
  /** The expanded clock row, if any. */
  sel: TaskId | null;
  doneOpen: DoneKey | null;
  toast: ToastState | null;
  toastOut: boolean;
  surrender: Surrender | null;
  captureOpen: boolean;
  pickerOpen: boolean;
  notifOpen: boolean;
  settingsOpen: boolean;
  draft: Draft;
  newPlace: string;
  focus: Focus | null;
  /** The row that just landed, flashed with ppPop. */
  flash: TaskId | null;
  /** The welcome: showing, leaving, or gone. Never persisted. */
  greet: 'in' | 'out' | null;
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
  | { type: 'setPhoneScreen'; screen: PhoneScreen }
  | { type: 'push'; notif: Notif }
  | { type: 'toast'; toast: ToastState }
  | { type: 'toastOut' }
  | { type: 'toastGone' }
  | { type: 'setWeek'; wk: number }
  | { type: 'stepWeek'; by: number }
  | { type: 'openSurrender'; surrender: Surrender }
  | { type: 'cancelSurrender' }
  | { type: 'giveAway'; id: string; blockKey: string; taskId: TaskId | null }
  | { type: 'setCapture'; open: boolean }
  | { type: 'setDraft'; patch: Partial<Draft> }
  | { type: 'addTask'; task: Task }
  | { type: 'setPicker'; open: boolean }
  | { type: 'setNewPlace'; value: string }
  | { type: 'addPlace'; place: Place }
  | { type: 'setNotifOpen'; open: boolean }
  | { type: 'clearNotifs' }
  | { type: 'setPerm'; perm: NotificationPermission }
  | { type: 'startFocus'; id: TaskId; mins: number }
  | { type: 'focusTick' }
  | { type: 'focusPause' }
  | { type: 'focusStop' }
  | { type: 'flash'; id: TaskId | null }
  | { type: 'greet'; phase: 'in' | 'out' | null }
  | { type: 'setSettingsOpen'; open: boolean }
  | { type: 'setSetting'; patch: Partial<Settings> };

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
    case 'setPhoneScreen':
      return { ...state, aScreen: action.screen };
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
    // One row per surrender, so two devices merging keep both. ADR-001 §5.3.
    case 'giveAway':
      return {
        ...state,
        surrender: null,
        surrenders: [
          ...state.surrenders,
          { id: action.id, blockKey: action.blockKey, taskId: action.taskId, at: Date.now() },
        ],
      };

    case 'setCapture':
      return {
        ...state,
        captureOpen: action.open,
        // Leaving the sheet abandons the draft rather than half-remembering it.
        draft: action.open ? state.draft : { ...state.draft, title: '' },
      };
    case 'setDraft':
      return { ...state, draft: { ...state.draft, ...action.patch } };
    case 'addTask':
      return {
        ...state,
        added: [...state.added, action.task],
        captureOpen: false,
        draft: { ...state.draft, title: '' },
      };

    case 'setPicker':
      return { ...state, pickerOpen: action.open };
    case 'setNewPlace':
      return { ...state, newPlace: action.value };
    case 'addPlace':
      // Adding a place switches to it immediately.
      return {
        ...state,
        places: [...state.places, action.place],
        newPlace: '',
        here: action.place.id,
        aHere: action.place.id,
        pickerOpen: false,
      };

    case 'setNotifOpen':
      return { ...state, notifOpen: action.open };
    case 'clearNotifs':
      return { ...state, notifs: [] };
    case 'setPerm':
      return { ...state, perm: action.perm };

    case 'startFocus':
      return { ...state, focus: { id: action.id, mins: action.mins, left: action.mins * 60, paused: false, done: false } };
    case 'focusTick': {
      const f = state.focus;
      if (!f || f.paused || f.done) return state;
      if (f.left <= 1) return { ...state, focus: { ...f, left: 0, done: true } };
      return { ...state, focus: { ...f, left: f.left - 1 } };
    }
    case 'focusPause':
      return state.focus ? { ...state, focus: { ...state.focus, paused: !state.focus.paused } } : state;
    case 'focusStop':
      return { ...state, focus: null };

    case 'flash':
      return { ...state, flash: action.id };
    case 'greet':
      return { ...state, greet: action.phase };
    case 'setSettingsOpen':
      return { ...state, settingsOpen: action.open };
    case 'setSetting':
      return { ...state, settings: { ...state.settings, ...action.patch } };
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
  'surrenders',
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
  'settings',
] as const satisfies readonly (keyof PlannerState)[];

function serialize(state: AppState): string {
  const out: Record<string, unknown> = {};
  for (const k of DURABLE) out[k] = state[k];
  return JSON.stringify(out);
}

function load(): AppState {
  // Transient UI rehydrates to defaults: a reload mid-focus-timer lands on a clean
  // screen, not a stale overlay.
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
    settingsOpen: false,
    draft: EMPTY_DRAFT,
    newPlace: '',
    focus: null,
    flash: null,
    greet: 'in',
    now: new Date(),
  };
  try {
    const raw = localStorage.getItem(DEFAULTS.localStorageKey);
    if (!raw) return base;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null) return base;
    const bag = saved as Record<string, unknown>;
    const merged = { ...base };
    // Storage is untrusted input: it survives schema changes, hand editing and partial
    // writes. A wrong shape here reaches the selectors and takes the whole app down, so
    // each key is checked and anything that fails falls back to its default.
    for (const k of DURABLE) {
      const value = bag[k];
      if (value === undefined) continue;
      if (!isValidDurable(k, value)) continue;
      Object.assign(merged, { [k]: value });
    }
    return merged;
  } catch {
    // Unreadable or unparseable storage is not worth losing the session over.
    return base;
  }
}

const TABS: readonly Tab[] = ['today', 'week', 'due', 'zones'];
const SCREENS: readonly PhoneScreen[] = ['now', 'due', 'week', 'streams'];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every value is `Record<TaskId, number>`-shaped. */
const isStampMap = (v: unknown): boolean =>
  isRecord(v) && Object.values(v).every((x) => typeof x === 'number' && Number.isFinite(x));

const isTaskish = (v: unknown): boolean =>
  isRecord(v) &&
  typeof v['id'] === 'string' &&
  typeof v['title'] === 'string' &&
  typeof v['stream'] === 'string' &&
  (v['rule'] === 'clock' || v['rule'] === 'place' || v['rule'] === 'none');

const isPlaceish = (v: unknown): boolean =>
  isRecord(v) && typeof v['id'] === 'string' && typeof v['name'] === 'string';

function isValidDurable(key: (typeof DURABLE)[number], v: unknown): boolean {
  switch (key) {
    case 'tab':
      return TABS.includes(v as Tab);
    case 'aScreen':
      return SCREENS.includes(v as PhoneScreen);
    case 'here':
    case 'aHere':
      return typeof v === 'string';
    case 'stream':
      return v === null || typeof v === 'string';
    case 'perm':
      return v === 'default' || v === 'granted' || v === 'denied';
    case 'added':
      return Array.isArray(v) && v.every(isTaskish);
    case 'places':
      return Array.isArray(v) && v.every(isPlaceish);
    case 'removed':
      return Array.isArray(v) && v.every((x) => typeof x === 'string');
    case 'notifs':
      return Array.isArray(v) && v.every((x) => isRecord(x) && typeof x['title'] === 'string');
    case 'surrenders':
      return Array.isArray(v) && v.every((x) => isRecord(x) && typeof x['blockKey'] === 'string');
    case 'done':
    case 'ended':
    case 'moved':
    case 'confirmed':
      return isStampMap(v);
    case 'skips':
      return (
        isRecord(v) &&
        Object.values(v).every(
          (x) => Array.isArray(x) && x.every((d) => typeof d === 'string'),
        )
      );
    case 'settings':
      return (
        isRecord(v) &&
        typeof v['userName'] === 'string' &&
        typeof v['contextAware'] === 'boolean' &&
        (v['clockStyle'] === 'countdown' || v['clockStyle'] === 'absolute') &&
        (v['projectDefense'] === 'quota' ||
          v['projectDefense'] === 'neglect' ||
          v['projectDefense'] === 'both')
      );
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
  setPhoneScreen: (screen: PhoneScreen) => void;
  pushBack: (title: string) => void;
  planTrip: (names: string[], back: string) => void;
  setWeek: (wk: number) => void;
  stepWeek: (by: number) => void;
  openSurrender: (surrender: Surrender) => void;
  cancelSurrender: () => void;
  giveAway: (surrender: Surrender, toTitle: string) => void;
  openCapture: () => void;
  closeCapture: () => void;
  setDraft: (patch: Partial<Draft>) => void;
  saveDraft: () => void;
  openPicker: () => void;
  closePicker: () => void;
  setNewPlace: (value: string) => void;
  addPlace: () => void;
  toggleNotif: () => void;
  closeNotif: () => void;
  clearNotifs: () => void;
  askNotify: () => void;
  skipGreeting: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setSetting: (patch: Partial<Settings>) => void;
  startFocus: (id: TaskId, mins: number) => void;
  pauseFocus: () => void;
  stopFocus: (complete: boolean) => void;
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

  /*
   * Browsers throttle timers in a background tab and freeze them outright when a phone
   * sleeps, so the countdown can be minutes stale by the time the screen comes back.
   * Catch the moment it returns and re-tick at once rather than waiting for a timer
   * that may itself be overdue.
   */
  useEffect(() => {
    const resync = (): void => {
      if (document.visibilityState === 'visible') dispatch({ type: 'tick', now: new Date() });
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    window.addEventListener('pageshow', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
      window.removeEventListener('pageshow', resync);
    };
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

  // The focus timer. One interval, torn down with the block.
  useEffect(() => {
    if (!state.focus || state.focus.paused || state.focus.done) return;
    const id = setInterval(() => dispatch({ type: 'focusTick' }), 1000);
    return () => clearInterval(id);
  }, [state.focus]);

  // Finishing buzzes long and posts a notification, exactly once.
  const focusAnnounced = useRef<string | null>(null);
  useEffect(() => {
    const f = state.focus;
    if (!f?.done) {
      if (!f) focusAnnounced.current = null;
      return;
    }
    if (focusAnnounced.current === f.id) return;
    focusAnnounced.current = f.id;
    buzz(HAPTIC.focusComplete);
    const t = findTask(live.current, f.id);
    pushRef.current?.(
      'Focus block finished',
      `${t?.title ?? 'Your block'} — ${f.mins} minutes held.`,
      PALETTE.build,
    );
  }, [state.focus]);

  // The welcome holds, then leaves. Each phase owns its own timer: a single effect
  // keyed on `greet` would cancel the removal timer the moment the phase changed to
  // 'out', stranding the overlay on screen forever.
  useEffect(() => {
    if (state.greet !== 'in') return;
    const out = setTimeout(() => dispatch({ type: 'greet', phase: 'out' }), TIMING.greetHold);
    return () => clearTimeout(out);
  }, [state.greet]);

  useEffect(() => {
    if (state.greet !== 'out') return;
    const gone = setTimeout(
      () => dispatch({ type: 'greet', phase: null }),
      TIMING.greetGone - TIMING.greetHold,
    );
    return () => clearTimeout(gone);
  }, [state.greet]);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flash = useCallback((id: TaskId) => {
    clearTimeout(flashTimer.current);
    dispatch({ type: 'flash', id });
    flashTimer.current = setTimeout(() => dispatch({ type: 'flash', id: null }), TIMING.flash);
  }, []);

  const showToast = useCallback((title: string, sub: string, color: string = PALETTE.contract) => {
    dispatch({ type: 'toast', toast: { title, sub, color } });
  }, []);

  const push = useCallback(
    (title: string, body: string, color: string = PALETTE.contract, silent = false) => {
      dispatch({
        type: 'push',
        notif: {
          id: Date.now() + Math.random(),
          title,
          body,
          color,
          at: hhmm(new Date(), DEFAULTS.homeTimezone),
        },
      });
      if (!silent) buzz(HAPTIC.crossedHour[0]);
      // Once permission is granted, real system notifications fire alongside.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(title, { body });
        } catch {
          // Some browsers refuse constructor notifications outside a service worker.
        }
      }
    },
    [],
  );

  // The focus-finished effect above runs before `push` is declared, so it reaches it
  // through a ref rather than forcing a declaration order that reads backwards.
  const pushRef = useRef<typeof push | null>(null);
  pushRef.current = push;

  // Anything crossing the last hour buzzes once and says so. Cleared when it leaves.
  const critical = useRef<Set<TaskId> | null>(null);
  useEffect(() => {
    const s = live.current;
    const c: Clock = { t0: T0, now: s.now, tz: DEFAULTS.homeTimezone };
    const seen = (critical.current ??= new Set(
      byRule(s, 'clock')
        .filter((t) => {
          const ms = dueOf(s, c, t).getTime() - Date.now();
          return ms > 0 && ms < HOUR_MS;
        })
        .map((t) => t.id),
    ));

    for (const t of byRule(s, 'clock')) {
      const ms = dueOf(s, c, t).getTime() - Date.now();
      if (ms > 0 && ms < HOUR_MS) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          buzz(HAPTIC.crossedHour);
          dispatch({
            type: 'toast',
            toast: {
              title: 'Under an hour',
              sub: `${t.title} closes at ${hhmm(dueOf(s, c, t), c.tz)} EAT.`,
              color: PALETTE.alarm,
            },
          });
        }
      } else seen.delete(t.id);
    }
  }, [state.now]);

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
      setPhoneScreen: (screen) => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'setPhoneScreen', screen });
      },
      pushBack: (taskTitle) => {
        buzz(HAPTIC.receipt);
        push(
          'Pushed to this evening',
          `${taskTitle} moved out of the way. The 20:15 slot is still defended.`,
          PALETTE.workshop,
        );
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
        dispatch({
          type: 'giveAway',
          id: newId(),
          blockKey: surrender.key,
          taskId: surrender.taskId,
        });
        if (surrender.taskId !== null) {
          push(
            'Block surrendered',
            `${short(surrender.taskId)} lost ${surrender.when} to ${toTitle}.`,
            PALETTE.alarm,
          );
        }
      },

      openCapture: () => {
        buzz(HAPTIC.undo);
        dispatch({ type: 'setCapture', open: true });
      },
      closeCapture: () => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'setCapture', open: false });
      },
      setDraft: (patch) => {
        dispatch({ type: 'setDraft', patch });
      },
      saveDraft: () => {
        const s = live.current;
        const d = s.draft;
        const title = d.title.trim();
        if (!title) return;

        const id = newId();
        const c: Clock = { t0: T0, now: s.now, tz: DEFAULTS.homeTimezone };
        const common = { id, title, short: title.slice(0, 22), stream: d.stream };
        let task: Task;

        if (d.rule === 'place') {
          const timed = d.repeat === 'weekly' || d.repeat === 'today';
          const [rh = 9, rm = 0] = (d.time || '09:00').split(':').map(Number);
          task = {
            ...common,
            rule: 'place',
            place: d.place,
            est: '~30m',
            ...(timed ? { at: (rh || 0) + (rm || 0) / 60 } : { queued: 'just now' }),
            ...(d.repeat === 'weekly' ? { dow: d.dow } : {}),
          };
        } else if (d.rule === 'clock') {
          const [hh = 15, mm = 0] = (d.time || '15:00').split(':').map(Number);
          const due = nextInZone(d.tz, hh || 0, mm || 0, s.now);
          const city = zoneCity(d.tz, SEED_ZONES);
          task = {
            ...common,
            rule: 'clock',
            dueAt: due.getTime(),
            tz: d.tz,
            who: 'client',
            pct: 5,
            note: `Entered as ${d.time || '15:00'} ${city}`,
            notes: `You entered ${d.time || '15:00'} ${city}. The planner stores the instant and shows it to you as ${hhmm(due, c.tz)} EAT.`,
          };
        } else {
          task = { ...common, rule: 'none', sub: 'Added from capture · no date', staleDays: 0, lost: 0 };
        }

        buzz(HAPTIC.addTask);
        dispatch({ type: 'addTask', task });

        const where = {
          clock: 'locked to a clock',
          place: `locked to ${placeName(s, d.place)}`,
          none: 'locked to nothing',
        }[d.rule];
        flash(id);
        showToast(`Added to ${d.stream}`, `${title} — ${where}.`, PALETTE.contract);
        push(`Added to ${d.stream}`, `${title} — ${where}.`, PALETTE.contract);
      },

      openPicker: () => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'setPicker', open: true });
      },
      closePicker: () => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'setPicker', open: false });
      },
      setNewPlace: (value) => {
        dispatch({ type: 'setNewPlace', value });
      },
      addPlace: () => {
        const name = live.current.newPlace.trim();
        if (!name) return;
        buzz(HAPTIC.addPlace);
        dispatch({
          type: 'addPlace',
          place: { id: newId(), name, kind: 'Yours', travel: 15 },
        });
      },

      toggleNotif: () => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'setNotifOpen', open: !live.current.notifOpen });
      },
      closeNotif: () => {
        dispatch({ type: 'setNotifOpen', open: false });
      },
      clearNotifs: () => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'clearNotifs' });
      },
      askNotify: () => {
        buzz(HAPTIC.tap);
        if (typeof Notification === 'undefined') return;
        void Notification.requestPermission().then((perm) => {
          dispatch({ type: 'setPerm', perm });
          if (perm === 'granted') {
            push(
              'Alerts are on',
              'Deadlines crossing 8 hours and place arrivals will reach you here.',
              INK.green,
            );
          }
        });
      },

      openSettings: () => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'setSettingsOpen', open: true });
      },
      closeSettings: () => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'setSettingsOpen', open: false });
      },
      setSetting: (patch) => {
        dispatch({ type: 'setSetting', patch });
      },
      // Skipping just starts the exit; the phase effect above removes it.
      skipGreeting: () => {
        if (live.current.greet !== 'in') return;
        buzz(HAPTIC.tap);
        dispatch({ type: 'greet', phase: 'out' });
      },
      startFocus: (id, mins) => {
        buzz(HAPTIC.focusStart);
        dispatch({ type: 'startFocus', id, mins });
      },
      pauseFocus: () => {
        buzz(HAPTIC.tap);
        dispatch({ type: 'focusPause' });
      },
      stopFocus: (complete) => {
        const f = live.current.focus;
        dispatch({ type: 'focusStop' });
        if (!f) return;
        if (complete) {
          buzz(HAPTIC.complete);
          dispatch({ type: 'complete', id: f.id });
          push('Done', title(f.id), PALETTE.build);
        } else {
          buzz(HAPTIC.undo);
          showToast(
            'Focus stopped',
            'Nothing was ticked off. The block is still yours to take.',
            PALETTE.workshop,
          );
        }
      },
      showToast,
      push,
    };
  }, [push, showToast, flash]);

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
