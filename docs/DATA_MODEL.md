# Data model

## Types

```ts
type Rule = 'clock' | 'place' | 'none';

type Stream = 'Contract' | 'Writing' | 'Applications' | 'Life & errands' | 'Personal builds';

interface Place {
  id: string;
  name: string;
  kind: 'Where you work' | 'Errands' | 'Standing places' | 'Yours';
  travel: number;          // minutes one way from home; 0 = no travel
}

interface Task {
  id: string;
  stream: Stream;
  rule: Rule;
  title: string;           // full copy, shown on desktop
  short?: string;          // shown in the day timeline and toasts

  // clock-locked
  at?: number;             // absolute hour today (23 = 23:00 local)
  h?: number;              // OR hours from load, for a rolling demo
  tz?: string;             // IANA zone the *setter* used
  who?: 'client' | 'call' | 'reviewer' | 'agency' | 'portal';
  pct?: number;            // progress 0–100
  sleep?: boolean;         // deadline lands while the user is asleep
  note?: string;           // one-line consequence
  notes?: string;          // paragraph shown when the row is expanded

  // place-locked
  place?: string;          // Place id
  dow?: number;            // 0=Mon … 6=Sun; presence means it repeats weekly
  est?: string;            // '~45m', '~2h'
  queued?: string;         // '3d' — how long it has been waiting

  // locked to nothing
  sub?: string;
  staleDays?: number;      // days since last touched
  lost?: number;           // times it lost to a deadline
}
```

A task carries **exactly one** rule. Fields from the other two blocks are absent, not empty — do not merge them into one flat optional bag with defaults.

## Seed data

`sample_data.json` — 5 streams, 7 places, 22 tasks, 27 calendar blocks, 3 unclaimed-slot marks, 10 timezones. Load it verbatim for the demo build; it was tuned so the screens hit their real density and every edge case (a deadline while asleep, a 19-day-neglected project, two errands at the same place, a repeat that can be skipped).

Note the two ways a clock deadline is expressed: `at` (a fixed hour today) and `h` (hours from load). `h` keeps the demo rolling no matter when it opens — `ch3` is always 26 hours out. Keep both.

## Derived logic — port exactly

| Function | Behavior |
|---|---|
| `dueOf(task)` | `h` → now + h hours; `at` → today at that hour; with `dow`, the next occurrence of that weekday at `at`. |
| `urgency(due)` | `0` calm · `1` inside 8 h · `2` inside 1 h · `3` past. Drives color and animation. |
| `nextActive(task)` | Next occurrence, skipping any date in `skips[id]`; `null` if `ended[id]`. |
| `travelTo(placeId)` | `place.travel`, default 15 min. |
| `minsOf(task)` | Parses `est` (`~45m`, `~2h`) to minutes. |
| Trip planner | Every untimed errand grouped by place, sorted nearest-first. Total = `farthest × 2 + 8 min per extra stop + sum(work)`. Renders "Leave now, back by HH:MM". |
| Streak | Consecutive days ending today with at least one completion (scan back 30 days, break on the first empty day after today). |
| Quota | `3.5 h` base + hours of completed `rule:'none'` blocks, against `6.0 h` weekly. |
| Leave-by | For a timed place item: due − travel to that place. Turns red once it is past. |

## Ordering — both platforms

- **Clock-locked:** soonest deadline first.
- **Place-locked:** grouped by place; groups sorted by the soonest item inside them; **timed items first, untimed sink to the bottom**. The group matching the user's current place renders live (full opacity, colored border); all others dim to `opacity: .62`.
- **Locked to nothing:** most-neglected first (`staleDays` descending).
- Completed items leave their list and collect in a "✓ N done" collapsible with per-row **Undo**.

## State

```ts
{
  tab, here, stream,              // desktop: active tab, current place, stream filter
  aScreen, aHere,                 // phone: active screen, current place
  capture, aCapture, picker, aPicker, notifOpen, sel, doneOpen,
  done: Record<TaskId, timestamp>,
  added: Task[], removed: TaskId[], places: Place[],
  skips: Record<TaskId, DayKey[]>, ended: Record<TaskId, ts>,
  moved: Record<TaskId, ts>, confirmed: Record<TaskId, ts>, losses: Record<TaskId, number>,
  notifs: Notif[], perm: NotificationPermission,
  focus: { id, mins, left, paused, done } | null,
  greet, flash, toast, toastOut, draft, newPlace, now
}
```

Seed tasks are never mutated. Edits are recorded as overlays — `done`, `removed`, `skips`, `ended`, `moved`, `confirmed` — and applied on read. New tasks land in `added`. This keeps the seed immutable and undo trivial.

## Persistence

Key: `parallelPlanner.ios.v2`.

Persist only the durable half — `tab, here, stream, aScreen, aHere, losses, added, removed, places, notifs, perm, done, skips, ended, moved, confirmed`.

Rehydrate transient UI to defaults on load — `capture, aCapture, picker, aPicker, notifOpen, focus, toast, toastOut, greet, flash`. A user who reloads mid-focus-timer should land on a clean Now screen, not a stale overlay. Writes are diffed against the last payload so an unchanged tick doesn't hit storage.

## The clock

One timer, not one per task. If anything is inside an hour, tick every **1 s**; otherwise every **20 s**, and reschedule after each tick.

On every tick, re-check whether any deadline just crossed the 1-hour line. The first crossing for a given task buzzes `[18, 60, 18]` and raises a toast — once, tracked in a `Set` of task ids, cleared when the task leaves the window.

## Actions

`completeTask` · `undoDone` · `removeTask` · `addTask` (from capture draft) · `addPlace` · `goTo(place)` · `skipOnce` · `endSeries` · `resumeSeries` · `moveTo(when)` · `confirmReceipt` · `startFocus(id, mins)` · `pauseFocus` · `stopFocus(complete)` · `askNotify` · `push(notif)`.

Each one buzzes and most raise a toast. Timings and buzz lengths are in DESIGN_TOKENS.

## Configurable

Four knobs exist as props in the prototype; expose them as user settings.

| Setting | Type | Default | Effect |
|---|---|---|---|
| `userName` | string | `Boniface` | Greeting |
| `contextAware` | boolean | `true` | Off → place groups stop dimming; everything reads live |
| `clockStyle` | `'countdown' \| 'absolute'` | `countdown` | Countdowns vs absolute times |
| `projectDefense` | `'quota' \| 'neglect' \| 'both'` | `both` | What the defended card reports |
