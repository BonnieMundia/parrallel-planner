/**
 * The durable half of the app state — the part selectors read and persistence writes.
 * Seed tasks are never mutated: every edit is an overlay (`done`, `removed`, `skips`,
 * `ended`, `moved`, `confirmed`) applied on read, which keeps undo trivial.
 *
 * Transient UI (capture, pickers, focus, toasts, draft) joins this in the store.
 */

import type { Place, PlaceId, Stream, Task, TaskId } from './types';

export type Tab = 'today' | 'week' | 'due' | 'zones';
export type PhoneScreen = 'now' | 'due' | 'week' | 'streams';

export interface Notif {
  id: number;
  title: string;
  body: string;
  color: string;
  /** 'HH:MM' at the moment it was raised. */
  at: string;
}

/** The four knobs the prototype carried as props. */
export interface Settings {
  userName: string;
  /** Off → place groups stop dimming; everything reads live. */
  contextAware: boolean;
  clockStyle: 'countdown' | 'absolute';
  projectDefense: 'quota' | 'neglect' | 'both';
}

export interface PlannerState {
  /** Desktop: active tab, current place, stream filter. */
  tab: Tab;
  here: PlaceId;
  stream: Stream | null;
  /** Phone: active screen, current place. */
  aScreen: PhoneScreen;
  aHere: PlaceId;
  /** Week offset from this week; 0 is this week. */
  wk: number;

  done: Readonly<Record<TaskId, number>>;
  added: readonly Task[];
  removed: readonly TaskId[];
  places: readonly Place[];
  /** Day keys a recurring item was skipped on. */
  skips: Readonly<Record<TaskId, readonly string[]>>;
  ended: Readonly<Record<TaskId, number>>;
  moved: Readonly<Record<TaskId, number>>;
  confirmed: Readonly<Record<TaskId, number>>;
  /** Keyed by task id, and by 'blk:<d>:<s>' for a surrendered calendar block. */
  losses: Readonly<Record<string, number>>;

  notifs: readonly Notif[];
  perm: NotificationPermission;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  userName: 'Boniface',
  contextAware: true,
  clockStyle: 'countdown',
  projectDefense: 'both',
};

export const INITIAL_STATE: PlannerState = {
  tab: 'today',
  here: 'desk',
  stream: null,
  aScreen: 'now',
  aHere: 'desk',
  wk: 0,
  done: {},
  added: [],
  removed: [],
  places: [],
  skips: {},
  ended: {},
  moved: {},
  confirmed: {},
  losses: {},
  notifs: [],
  perm: 'default',
  settings: DEFAULT_SETTINGS,
};
