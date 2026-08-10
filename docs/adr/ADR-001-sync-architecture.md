# ADR-001: Cross-device sync, a hosted backend, and an optional native client

**Status:** Proposed
**Date:** 2026-08-10
**Deciders:** Boniface (owner), designer (for the copy and behaviour questions in §12)
**Supersedes:** nothing
**Affects:** `CLAUDE.md` (the "no backend, no data-fetching library" rule), `BUILD_SETUP.md` (hosting), `DATA_MODEL.md` (persistence), `README.md` (Known gaps)

---

## 1. Context

### 1.1 Where the build stands

The app is a static single-page React app. There is no server. All state lives in
`localStorage` under `parallelPlanner.ios.v2`, written by `src/app/store.tsx` and read
back on load. Steps 1–7 of `BUILD_SETUP.md` are complete: domain model, pure selectors,
tokens and primitives, the desktop Today/Week/Deadlines/Zones tabs, and the phone
Now/Due/Week/Streams screens. Steps 8–10 (capture, places, focus, notifications; motion
and haptics; deploy) remain.

Because persistence is per-origin `localStorage`, **each browser is its own island**.
The phone and the desktop never see each other's data. This was an accepted launch
condition, recorded in `BUILD_SETUP.md`:

> Because state lives in `localStorage`, each browser is its own island — the phone and
> the desktop do not share data. Acceptable for launch; see Known gaps in README.

`README.md` names the same limit and calls it "a fork in the road later, not a blocker
now".

### 1.2 The two honest limits the prototype states

The design prototype closes with two admissions, neither of which the current build
solves:

1. **No real location awareness.** The current place is picked by hand from a list.
   Place-locked work therefore surfaces because the user told the app where they are,
   not because they arrived somewhere.
2. **No server, so nothing syncs.** Notifications are local: the bell requests real
   system permission and raises real notifications, but only while the page is open.
   Alerts that reach a phone with the app closed need a service worker and a push server.

### 1.3 What triggered this decision

The app was loaded onto a physical Android device over `adb reverse` during step 7. The
production build runs correctly there, but it immediately demonstrated the island
problem: the dev server on `:5173` and the production preview on `:4173` are different
origins and therefore hold **completely separate task state on the same phone**. If two
ports on one device cannot agree, two devices certainly cannot.

The question this ADR answers: *if we add Supabase or Firebase and optionally go native,
does the web app and the phone app share one set of data over the internet?*

### 1.4 Forces at play

- **The domain is small.** 22 seed tasks, 7 places, 5 streams. This is not a scale
  problem; it is a correctness and continuity problem.
- **Single user, several devices.** There is no collaboration requirement. No shared
  workspaces, no permissions model beyond "this row is mine".
- **Offline must keep working.** The app's whole premise is that it tells you what is
  possible right now. An app that shows a spinner in a supermarket queue has failed at
  the moment it was designed for.
- **The purity discipline is already paid for.** `domain/select.ts` and `app/clock.ts`
  are pure functions of `(state, clock)` with 142 passing tests and no React or DOM
  imports. That was a deliberate constraint in `CLAUDE.md`; it is the reason most of
  this ADR is cheap.
- **The overlay model is already sync-shaped.** See §4. This is the single most
  important fact in this document.

---

## 2. Decision

**Adopt Supabase (Postgres + Row Level Security + Realtime) as the backend, model all
mutations as an append-only event log folded into the existing overlay shape, and treat
a native client as a separate, later, optional decision.**

Concretely:

1. Keep `domain/select.ts` and its `(state, clock)` signature exactly as it is. The
   selectors must not learn that a network exists.
2. Replace the `localStorage` read/write in `store.tsx` with a Supabase-backed
   repository that produces the *same* `PlannerState` shape.
3. Move task mutations from in-place overlay records to rows in a `task_events` table
   with client-generated UUID ids, so replays are idempotent.
4. Do the three data-model corrections in §5 **before** any sync code is written. Two of
   them are latent bugs today.
5. Ship the static build (steps 8–10) first. Sync is additive.
6. Defer native. A web app manifest plus a service worker delivers a large share of the
   perceived benefit for roughly a tenth of the work, and does not fork the codebase.

---

## 3. Options considered

### 3.1 Backend options

#### Option A: Stay static (do nothing)

| Dimension | Assessment |
|---|---|
| Complexity | None |
| Cost | Zero |
| Scalability | Irrelevant — no server |
| Team familiarity | Already built |
| Offline | Perfect, trivially |
| Time to implement | Zero |

**Pros**

- Nothing to operate, nothing to pay for, nothing to breach.
- Deploy stays purely static; `vercel.json` is the entire infrastructure.
- No auth, therefore no auth bugs, no password resets, no session expiry.
- Instant reads. No loading states anywhere in the UI, which is why the current
  screens have no empty/loading states specified — and `CLAUDE.md` forbids inventing
  copy for states the designer did not draw.

**Cons**

- The islands problem is permanent. Ticking something off on the phone leaves the
  desktop confidently wrong.
- Clearing browser data destroys everything, silently and irrecoverably.
- Notifications can never fire when the app is closed, which undercuts the product's
  central claim that it watches deadlines someone else set.
- No path to real location awareness that survives a page close.

#### Option B: Supabase — Postgres, RLS, Realtime  ← **chosen**

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Free tier is far beyond this workload; ~$25/mo if it ever outgrows it |
| Scalability | Vastly more than needed |
| Team familiarity | Account already exists and a connector is configured |
| Offline | Needs a hand-written queue (see §7) |
| Time to implement | ~3–5 focused sessions after step 10 |

**Pros**

- **The data is relational and the queries are relational.** "Place groups sorted by
  their soonest item, timed before untimed" is a join and a sort. Postgres is the right
  shape for tasks/places/streams/blocks/events.
- **Row Level Security is the entire multi-device authorisation story.** A single
  `auth.uid() = user_id` policy per table means correctness no longer depends on client
  code being careful.
- **Realtime subscriptions** push changes to an open web tab and a phone over
  websockets, with no polling and no manual invalidation.
- **`timestamptz` handles the instant-versus-wall-clock distinction properly**, which
  matters more in this app than in most — every screen renders a foreign zone against
  the user's own.
- SQL migrations are reviewable, diffable, and live in the repo.
- Auth, storage and edge functions are in the same product, so push notifications
  (§9.2) do not require a second vendor.

**Cons**

- Offline is not free. The JS client has no built-in write queue; §7 describes what has
  to be written by hand. This is the single largest piece of new work.
- Adds auth, and therefore adds screens the designer has not drawn — sign-in, sign-out,
  session-expired. `CLAUDE.md` says to ask rather than invent copy, so these are
  blocked on §12.
- Introduces loading and error states into a UI designed without them.
- Contradicts the current `CLAUDE.md` rules directly. That file needs amending as part
  of accepting this ADR, not quietly ignoring.

#### Option C: Firebase — Firestore, Auth, FCM

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Free tier generous; per-read pricing can surprise |
| Scalability | Vastly more than needed |
| Team familiarity | Lower |
| Offline | **Excellent** — genuinely best in class |
| Time to implement | ~3–5 sessions, but weighted differently |

**Pros**

- **Offline persistence is a one-line enable.** Writes queue and replay transparently;
  reads serve from a local cache. This solves by product what Option B solves by hand,
  and it is not a small advantage for an app meant to work in a supermarket.
- FCM is the most direct route to background push on Android.
- Real-time listeners are mature and pleasant.

**Cons**

- **The query model fights this domain.** Firestore has no joins and limited composite
  ordering. The place-group ordering, the trip planner and the review grid would all be
  computed client-side anyway — which is where they already live, so the database
  contributes little beyond storage.
- Security rules are a bespoke language and are markedly easier to get subtly wrong than
  a one-line SQL policy.
- Document modelling would push toward denormalising tasks into a per-user document,
  which reintroduces write conflicts that the event log (§4) otherwise eliminates.
- Per-read billing rewards caching cleverness — a distraction at this size.

#### Option D: Custom backend on Vercel functions + a managed Postgres

| Dimension | Assessment |
|---|---|
| Complexity | High |
| Cost | Comparable |
| Scalability | Fine |
| Team familiarity | Highest control, most surface |
| Offline | Hand-written, same as B |
| Time to implement | Substantially longer |

**Pros**

- Total control of the API surface and the merge semantics.
- No vendor lock-in beyond Postgres itself.

**Cons**

- Everything Supabase gives free — auth, RLS, realtime, generated types — becomes code
  to write, test and secure.
- Auth done by hand is the highest-risk component in this entire document.
- No realtime without also standing up a websocket layer.
- Cannot justify itself at single-user scale.

### 3.2 Client options

These are **independent** of the backend choice. Any of them works with Option B.

#### Option W: Responsive web only (current) + manifest + service worker

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Effort | ~30–60 lines plus icons |
| Reach | Every device with a browser |
| Push when closed | Yes, via service worker + Web Push |
| Location in background | **No** |
| Haptics on iOS | **No** — Safari has no vibration API |

Adds an installable home-screen icon, a standalone window without browser chrome, and
offline caching of the app shell. Does **not** give background geofencing.

#### Option N: React Native / Expo, sharing the domain layer

| Dimension | Assessment |
|---|---|
| Complexity | High |
| Effort | Full UI rewrite; ~60% of logic ports free |
| Reach | Android + iOS, store distribution |
| Push when closed | Yes, native |
| Location in background | **Yes** — geofencing |
| Haptics on iOS | **Yes** |

#### Option B(oth): web for desktop, native for phone, one Supabase behind them

The end state this ADR points at, but only if §9.3's prizes turn out to be worth it.

---

## 4. Why sync is tractable here: the overlay model

`DATA_MODEL.md` requires that seed tasks are never mutated:

> Seed tasks are never mutated. Edits are recorded as overlays — `done`, `removed`,
> `skips`, `ended`, `moved`, `confirmed` — and applied on read. New tasks land in
> `added`. This keeps the seed immutable and undo trivial.

That was written as an undo convenience. It is, in fact, **a conflict-free replication
design**, because every overlay is either a last-write-wins register keyed by task id or
a grow-only set. Neither needs a merge algorithm.

| Overlay | Current shape | Merge rule | Conflict-free? |
|---|---|---|---|
| `done` | `Record<TaskId, timestamp>` | Last-write-wins per key; the timestamp is already the version | Yes |
| `moved` | `Record<TaskId, timestamp>` | LWW per key | Yes |
| `confirmed` | `Record<TaskId, timestamp>` | LWW per key | Yes |
| `ended` | `Record<TaskId, timestamp>` | LWW per key | Yes |
| `removed` | `TaskId[]` | Set union — tombstones, order-free | Yes |
| `skips` | `Record<TaskId, DayKey[]>` | Set union per key | Yes |
| `added` | `Task[]` | Append-only, keyed by id | Yes, **once ids are UUIDs** (§5.2) |
| `places` | `Place[]` | Append-only, keyed by id | Yes, once ids are UUIDs |
| `losses` | `Record<string, number>` | **Counter — LWW loses increments** | **No** (§5.3) |

**The worked example that matters.** Complete a task on the phone at 14:02 while
offline. Undo it on the desktop at 14:05. Reconnect. The later event wins, the task
is not done, and both devices agree — with no merge code, because `done` is an LWW
register and the timestamp was always part of the value.

Had the app mutated `task.done = true` in place, the same scenario would require
either a conflict UI or an arbitrary winner. **The existing design is the reason this
ADR is short.**

---

## 5. Blocking prerequisites

These three changes must land **before** any sync code. Two are latent bugs in the
current build; the third is a design decision that cannot be deferred.

### 5.1 `h`-relative deadlines must become stored instants — **critical**

`src/domain/select.ts`:

```ts
const hours = t.rule === 'clock' ? (t.h ?? 24) : 24;
return new Date(clock.t0.getTime() + hours * 3_600_000);
```

`clock.t0` is **app load time**, fixed per session. `DATA_MODEL.md` explains why:

> `h` keeps the demo rolling no matter when it opens — `ch3` is always 26 hours out.

This is a demo affordance and it is actively hostile to sync. A phone that loaded at
09:00 and a laptop that loaded at 14:00 compute **different due instants for the same
task** — the two countdowns disagree by five hours, and the Zones screen places the same
deadline in two different parts of the day.

`at` (an absolute hour today, rolling to tomorrow once past) has the same problem in a
milder form, plus a second one: it silently means "today or tomorrow", which is not a
storable fact.

**Required change.** `tasks.due_at timestamptz` is the single source of truth for a
clock-locked deadline. `h` and `at` survive only as *seed authoring conveniences*,
resolved to a concrete instant exactly once, at import. Repeating place-locked work
keeps `repeat_dow` + `repeat_at` as a recurrence rule and resolves occurrences at read
time, which is already what `nextActive()` does.

Consequence: the seed stops "rolling". A demo opened in three weeks will show overdue
work. That is the correct behaviour for a real planner and the wrong behaviour for a
design prototype — worth stating out loud before it is chosen.

### 5.2 Task and place ids must be UUIDs — **latent bug**

The prototype mints ids as:

```js
const id = 'u' + Date.now();     // saveDraft()
const id = 'p' + Date.now();     // addPlace()
```

Two devices capturing within the same millisecond produce the same id. On one device
that is a curiosity; against a shared database it means **one person's task silently
overwrites another's**, or a primary-key violation, depending on the write path.

**Required change.** `crypto.randomUUID()`. This costs nothing and I will use it in
step 8 regardless of whether this ADR is accepted, because it is free insurance.

### 5.3 `losses` must become rows, not a counter — **merge hazard**

`losses` is keyed by task id *and* by `blk:<day>:<hour>` for surrendered calendar
blocks, and it increments. Two offline devices each incrementing 9 → 10 produce 10 after
an LWW merge, not 11. Surrender counts would quietly undercount, and they are load-bearing
copy: the phone hero reads "It has already lost this slot 9 times."

**Required change.** One row per surrender event in `task_events`, counted server-side
or folded client-side. The natural key already exists (`blk:<day>:<hour>`), so the
change is mechanical.

### 5.4 Also worth doing at the same time

- `notifs` currently persists to `localStorage` and is capped at 14. It is a device-local
  activity log, not shared state. **Do not sync it** — a notification raised on the phone
  is not an event on the desktop.
- `perm` (`NotificationPermission`) is inherently per-device and per-origin. Never sync.
- `tab`, `here`, `stream`, `aScreen`, `aHere`, `wk` are UI position. Syncing them would
  make one device yank another's view around. Keep them local. This splits the currently
  persisted set into **shared** and **device-local** halves; see §6.4.

---

## 6. Target architecture

### 6.1 Shape

```
┌────────────┐   ┌────────────┐
│ Web (SPA)  │   │ Phone      │      Both render from PlannerState.
│ Vercel     │   │ web or RN  │      Neither knows how it was assembled.
└─────┬──────┘   └─────┬──────┘
      │  repository interface (the only thing that changes)
      ├────────────────┤
      │  local cache (IndexedDB) + outbox queue
      ├────────────────┤
      │  supabase-js: auth, postgrest reads, realtime
      ▼                ▼
┌───────────────────────────────────┐
│ Supabase: Postgres + RLS          │
│  profiles · places · tasks        │
│  task_events (append-only)        │
│  blocks                           │
│ Edge function: deadline sweeper   │
└───────────────────────────────────┘
```

The critical property: **`select.ts` sits above the dotted line and is untouched.** It
receives a `PlannerState` and a `Clock` and does not care whether the state came from
`localStorage`, IndexedDB, or Postgres.

### 6.2 Schema

Illustrative, not yet applied. Postgres flavour.

```sql
create extension if not exists pgcrypto;

create type task_rule as enum ('clock', 'place', 'none');
create type setter    as enum ('client', 'call', 'reviewer', 'agency', 'portal');

create table profiles (
  id               uuid primary key references auth.users on delete cascade,
  user_name        text not null default 'Boniface',
  home_tz          text not null default 'Africa/Nairobi',
  context_aware    boolean not null default true,
  clock_style      text not null default 'countdown'
                     check (clock_style in ('countdown', 'absolute')),
  project_defense  text not null default 'both'
                     check (project_defense in ('quota', 'neglect', 'both')),
  updated_at       timestamptz not null default now()
);

create table places (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  name            text not null,
  kind            text not null
                    check (kind in ('Where you work','Errands','Standing places','Yours')),
  travel_minutes  integer not null default 15 check (travel_minutes >= 0),
  -- Real location awareness, when it arrives. Null until then.
  lat             double precision,
  lon             double precision,
  geofence_m      integer,
  deleted_at      timestamptz,
  updated_at      timestamptz not null default now()
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  rule         task_rule not null,
  stream       text not null,
  title        text not null,
  short        text,
  -- Not exclusive to place-locked work: a call is at 'anywhere', gym sessions at 'gym'.
  place_id     uuid references places(id) on delete set null,

  -- clock-locked
  due_at       timestamptz,        -- the resolved instant. Never an offset. See 5.1.
  setter_tz    text,               -- IANA zone the setter used, for "their clock"
  who          setter,
  pct          smallint check (pct between 0 and 100),
  sleeps       boolean not null default false,
  note         text,
  notes        text,

  -- place-locked
  repeat_dow   smallint check (repeat_dow between 0 and 6),   -- 0=Mon … 6=Sun
  repeat_at    numeric(4,2),                                   -- fractional hour, home zone
  est_minutes  integer,
  queued_since date,

  -- locked to nothing
  sub               text,
  last_touched_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  -- A task carries exactly one rule; fields from the other two stay null.
  constraint clock_needs_instant check (rule <> 'clock' or due_at is not null),
  constraint place_needs_place   check (rule <> 'place' or place_id is not null),
  constraint clock_only  check (rule = 'clock' or (due_at is null and who is null and pct is null)),
  constraint place_only  check (rule = 'place' or (repeat_dow is null and est_minutes is null)),
  constraint none_only   check (rule = 'none'  or (sub is null and last_touched_at is null))
);

create type event_kind as enum (
  'completed', 'uncompleted', 'removed', 'restored',
  'moved', 'receipt_confirmed',
  'series_skipped', 'series_ended', 'series_resumed',
  'block_surrendered'
);

-- Append-only. Client generates the id, so a replayed write is idempotent.
create table task_events (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade,
  task_id      uuid references tasks(id) on delete cascade,
  kind         event_kind not null,
  -- day_key for skips, new due_at for moves, 'blk:<d>:<h>' for surrenders
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null,   -- client wall clock; the LWW version
  received_at  timestamptz not null default now(),
  device_id    text
);

create index on task_events (user_id, occurred_at desc);
create index on task_events (user_id, task_id, kind);
create index on tasks (user_id) where deleted_at is null;

create table blocks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  task_id      uuid references tasks(id) on delete cascade,   -- null = unclaimed slot
  dow          smallint not null check (dow between 0 and 6),
  starts_at    numeric(4,2) not null,
  ends_at      numeric(4,2) not null,
  label        text,
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
```

### 6.3 Row Level Security

The whole authorisation model, applied identically to every table:

```sql
alter table profiles    enable row level security;
alter table places      enable row level security;
alter table tasks       enable row level security;
alter table task_events enable row level security;
alter table blocks      enable row level security;

create policy "own rows" on tasks
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- …repeated per table; profiles keys on id rather than user_id.
```

`using` governs reads and the pre-image of writes; `with check` stops a client
inserting a row it would not be allowed to read back. Both are required. With these in
place, a compromised or buggy client cannot read another user's tasks even if it asks.

### 6.4 Splitting the persisted state

Today `store.tsx` persists sixteen keys. Under sync they divide three ways:

| Keys | Where they live |
|---|---|
| `added`, `removed`, `places`, `done`, `skips`, `ended`, `moved`, `confirmed`, `losses` | **Shared** — Postgres, folded from `tasks` + `task_events` |
| `tab`, `here`, `stream`, `aScreen`, `aHere`, `wk` | **Device-local** — stays in `localStorage`. Syncing view position would let one device drag another's screen around |
| `notifs`, `perm` | **Device-local** — an activity log and a browser permission; neither is meaningful on another device |
| `settings` (`userName`, `contextAware`, `clockStyle`, `projectDefense`) | **Shared** — `profiles`. These are preferences, and a preference that does not follow you is an annoyance |

Note `here`/`aHere` being device-local is not merely pragmatic — it is *correct*. Where
you are standing is a property of the device in your pocket, not of your account. This
is also why the desktop and phone each have their own.

### 6.5 Folding events into state

```ts
// Illustrative. Lives in the repository layer, never in select.ts.
export function foldEvents(
  tasks: TaskRow[],
  events: TaskEventRow[],
): Pick<PlannerState, 'done' | 'removed' | 'skips' | 'ended' | 'moved' | 'confirmed' | 'losses'> {
  const out = { done: {}, removed: [], skips: {}, ended: {}, moved: {}, confirmed: {}, losses: {} };
  // occurred_at ascending: the last writer for a given key wins, which is the LWW rule.
  for (const e of [...events].sort((a, b) => a.occurred_at - b.occurred_at)) {
    switch (e.kind) {
      case 'completed':        out.done[e.task_id] = e.occurred_at; break;
      case 'uncompleted':      delete out.done[e.task_id]; break;
      case 'removed':          out.removed.push(e.task_id); break;
      case 'restored':         out.removed = out.removed.filter(id => id !== e.task_id); break;
      case 'moved':            out.moved[e.task_id] = e.payload.due_at; break;
      case 'receipt_confirmed':out.confirmed[e.task_id] = e.occurred_at; break;
      case 'series_skipped':   (out.skips[e.task_id] ??= []).push(e.payload.day_key); break;
      case 'series_ended':     out.ended[e.task_id] = e.occurred_at; break;
      case 'series_resumed':   delete out.ended[e.task_id]; break;
      // Counted, not overwritten — see 5.3.
      case 'block_surrendered':
        out.losses[e.payload.block_key] = 1;
        out.losses[e.task_id ?? 'unclaimed'] = (out.losses[e.task_id ?? 'unclaimed'] ?? 0) + 1;
        break;
    }
  }
  return out;
}
```

The output is byte-compatible with what the reducer holds today, which is the point:
`select.ts`, all 60-odd exported selectors, and all 142 tests keep working untouched.

---

## 7. Offline behaviour

This is the largest piece of genuinely new work under Option B, and the main respect in
which Option C would have been easier.

**Requirement.** The app must be fully usable with no network. Ticking work off in a
supermarket queue is the scenario the middle column exists for.

**Design.**

1. **Read path.** Hydrate from IndexedDB immediately on launch — no spinner, matching
   today's behaviour. Fetch from Supabase in the background; when it lands, re-fold and
   re-render. Realtime subscriptions patch incrementally after that.
2. **Write path.** Every mutation appends to a local **outbox** (an IndexedDB store) and
   is applied optimistically to local state at once. The UI never waits on a network
   round trip. This matches how the reducer already behaves.
3. **Flush.** On reconnect, POST outbox rows in `occurred_at` order. Because event ids
   are client-generated UUIDs, `insert … on conflict (id) do nothing` makes replays
   idempotent — a flush interrupted halfway is safe to retry wholesale.
4. **Clock skew.** `occurred_at` is the client's wall clock and is the LWW version. A
   phone with a badly wrong clock could win or lose incorrectly. Mitigation: record
   `received_at` server-side, and if `|occurred_at − received_at|` exceeds a threshold,
   trust the server's. Worth doing; not worth a vector clock at single-user scale.
5. **Tombstones.** Deletes are `deleted_at` timestamps, never `DELETE`. A hard delete on
   one device cannot be distinguished from "never seen" on another.

**Explicit non-goal.** Real-time collaborative editing. There is one user. Two devices
reconciling within seconds is the bar, not sub-second convergence.

---

## 8. What a native client would and would not inherit

### 8.1 Ports unchanged

| Module | Lines | Ports? | Why |
|---|---|---|---|
| `domain/types.ts` | ~150 | Yes | Pure types |
| `domain/seed.ts` | ~300 | Yes | Pure parsing |
| `domain/select.ts` | ~700 | Yes | Pure `(state, clock)`; no React, no DOM |
| `domain/state.ts` | ~90 | Yes | Pure types |
| `app/clock.ts` | ~280 | Yes* | Pure; *see §8.3 |
| `ui/dayLayout.ts` | ~70 | Yes | Pure geometry |
| `ui/tokens.ts` | ~110 | Partly | Values yes; `var(--x)` references need resolving to literals |
| `app/store.tsx` | ~450 | Reducer yes | Persistence, timer and context are platform-specific |
| `ui/primitives/**` | — | **No** | DOM, CSS Modules, `backdrop-filter` |
| `screens/**` | — | **No** | Full rewrite |

Roughly **60% of the logic and 0% of the UI**, and the 142 tests come with the logic
and keep passing — they are node-environment tests with no jsdom dependency, which was
a deliberate step-3 choice.

### 8.2 What must be rebuilt

- Every screen. React Native has no CSS Modules, no `backdrop-filter` (use
  `expo-blur`), no CSS custom properties, no `position: sticky`.
- The frosted-glass language is the biggest visual risk. `DESIGN_TOKENS.md` is emphatic:
  > Every surface is frosted. If the platform can't do `backdrop-filter`, fall back to
  > the same color at full opacity — do not drop to a flat mid-grey.
  `expo-blur` is close but not identical, and it costs real performance when many
  surfaces overlap. The Today screen has a sidebar, a top bar, a rail and up to a dozen
  cards blurring simultaneously.
- The right rail's absolutely-positioned timeline and the week grid's lane packing both
  assume CSS layout. `packLanes()` itself is pure and ports; the rendering does not.
- `localStorage` → `expo-secure-store` or MMKV.
- The single `setTimeout` clock needs to handle app backgrounding, which the web version
  gets free.

### 8.3 The one real technical risk: `Intl` on Hermes

**The entire application is timezone arithmetic.** `app/clock.ts` calls
`Intl.DateTimeFormat` with an explicit IANA `timeZone` on every task on every tick, and
`zoneAbbr()` additionally probes January and July offsets to decide DST.

React Native's Hermes engine has historically shipped without full ICU data, in which
case `timeZone: 'America/Los_Angeles'` is ignored or throws. Modern Expo generally
handles this, but **it must be verified on a physical device in the first hour of any
native effort**, before a single screen is written. If it does not work, every
countdown, every "their clock" line and the entire Zones screen is wrong, and the
fallback is a hand-rolled tz database — a materially different project.

Verification is one line:

```ts
parts(new Date(), 'America/Los_Angeles');   // must return real values, not the local zone
```

---

## 9. What each option actually buys

### 9.1 Sync (Option B alone)

- One set of tasks across every device.
- Survives clearing browser data, losing a phone, or switching laptops.
- Removes the `:5173` / `:4173` absurdity observed during step 7.

### 9.2 Background notifications

Currently impossible. The prototype admits it. Two routes:

- **Web (Option W):** service worker + Web Push + a Supabase edge function on a cron
  schedule that sweeps for deadlines crossing the eight-hour and one-hour lines. Works
  on Android Chrome; iOS Safari supports Web Push only for home-screen-installed apps
  and has been unreliable about it.
- **Native (Option N):** Expo Notifications over FCM/APNs. Straightforward and robust.

For an app whose premise is *"someone else set the time, in their zone"*, an alert that
only fires when you already have the app open is arguably the product's weakest point.
This is the strongest argument for going native — stronger than sync.

### 9.3 Real location

`README.md` lists hand-picking your current place as an open gap. `expo-location`
geofencing would make place-locked work surface **because you walked into Naivas**,
which is the idea the entire middle column is built around. The web Geolocation API
cannot do this in the background.

Combined with §9.2, these two are the actual case for native. Sync is available without
it.

### 9.4 Haptics on iOS

`DESIGN_TOKENS.md` specifies a buzz for every action and the prototype notes that iOS
Safari has no vibration API, so "on an iPhone the buttons will simply stay silent".
`expo-haptics` fixes this. Minor, but it is a designed-in behaviour that is currently
half-dead.

---

## 10. Trade-off analysis

**Supabase over Firebase** turns on one question: is the data relational? It is. The
ordering rules that define this product are joins and sorts. Firestore's superior
offline story is a genuine loss, and §7 is the price paid for it — but that price is a
few hundred lines of well-understood queue code, whereas fighting a document store's
query model is an ongoing tax on every feature. RLS being one line per table rather than
a rules DSL is the tiebreaker.

**Event log over mutable rows** costs a fold on read and buys conflict-freedom, an audit
trail, and — not incidentally — it is what the app already does in memory. Choosing
mutable rows would mean *discarding* the design that makes this easy.

**Web-plus-manifest over native, initially,** because the ratio is stark: a manifest and
a service worker are tens of lines against a full UI rewrite, and they deliver the
home-screen icon, the standalone window, offline caching, and on Android even push. The
things they cannot deliver — background geofencing, iOS haptics, reliable iOS push — are
real, but they are worth measuring against a shipped product rather than assumed in
advance.

**Doing the §5 prerequisites first** is non-negotiable. Two are latent bugs. The third
changes what a deadline *is*. Building sync on top of `t0 + h hours` would produce an
app that confidently disagrees with itself across devices, and the bug would look like a
sync bug while being a data-model bug.

---

## 11. Consequences

### Becomes easier

- One set of data. Every device agrees.
- Background notifications become possible for the first time.
- Real location becomes possible (native only).
- Losing a device stops meaning losing everything.
- The seed becomes a per-user import instead of a hard-coded constant, so the app stops
  being a demo of one person's week.

### Becomes harder

- **Loading and error states enter a UI that has none.** `CLAUDE.md` forbids inventing
  copy, and `SCREENS.md` specifies no empty, loading or offline states. This needs the
  designer (§12).
- **Auth needs screens that do not exist** — sign in, sign out, session expired.
- The deploy stops being purely static. `README.md` already anticipates this.
- Testing gets a second axis: two clients, one server, partial connectivity.
- Three `CLAUDE.md` rules need amending, not ignoring: no backend, no data-fetching
  library, and `localStorage` persistence.
- The demo stops rolling (§5.1). Someone opening it in a month sees overdue work.

### Needs revisiting later

- Whether `blocks` should be user-editable rather than seeded. Currently they are fixed
  authored data; the moment the calendar is real, they must be.
- Whether streams stay a fixed enum of five. A per-user table implies they are editable,
  which implies UI that does not exist.
- Clock-skew tolerance, if it ever bites.
- Whether `losses` should be scoped to the week being viewed rather than all-time — a
  question already raised in step 6, where the Builds review row reads "0 of 5 blocks
  kept" because 24 all-time surrenders swamp 5 booked blocks.

---

## 12. Open questions — designer

These block implementation and are not mine to decide.

1. **Sign-in.** What does it look like? Email magic link is the least friction and needs
   the fewest screens. Copy required for: signed-out state, link-sent confirmation,
   session expired.
2. **Offline indication.** Does the user ever learn they are offline? The current design
   has no affordance for it. Silent-and-optimistic is defensible; so is a discreet mark.
3. **Sync conflict visibility.** When the phone's completion loses to the desktop's
   undo, is that visible? Recommendation: no — LWW silently, because surfacing it would
   need a UI language the product does not have.
4. **The rolling seed.** Confirm that fixing deadlines to real instants (§5.1) is
   acceptable, given a demo opened weeks later shows overdue work.
5. **Loading state.** IndexedDB hydration makes the first paint instant, so possibly
   nothing is needed. Confirm.
6. **`losses` scope** — all-time or per-week (§11)?

---

## 13. Action items

**Before any sync work — do these regardless (steps 8–10):**

1. [ ] Use `crypto.randomUUID()` for task and place ids in capture (step 8). *Free
   insurance; will do this anyway.* (§5.2)
2. [ ] Record surrenders as events rather than incrementing a counter. (§5.3)
3. [ ] Finish steps 8–10 and deploy the static build. Sync is additive, and the overlay
   set is not complete until capture ships.

**Phase 1 — installable web (small, high value):**

4. [ ] Add `manifest.webmanifest` + icons generated from `ui/Mark.tsx`.
5. [ ] Add a service worker caching the app shell.
6. [ ] Verify "Add to Home screen" on the connected `CPH2363`.

**Phase 2 — Supabase, read-only first:**

7. [ ] Resolve §12 with the designer, especially 1 and 4.
8. [ ] Amend `CLAUDE.md`: backend, data-fetching, persistence.
9. [ ] Migration 001: schema (§6.2) + RLS (§6.3).
10. [ ] Auth: email magic link.
11. [ ] Seed import — one-time, per user, resolving `h`/`at` to instants (§5.1).
12. [ ] Repository layer behind the reducer; `foldEvents()` (§6.5). **`select.ts` must
    not change.** The 142 tests are the check.

**Phase 3 — writes and offline:**

13. [ ] IndexedDB cache + outbox with idempotent flush (§7).
14. [ ] Realtime subscription patching state incrementally.
15. [ ] Two-device test matrix: offline/offline, offline/online, clock skew.

**Phase 4 — background alerts:**

16. [ ] Edge function sweeping for the eight-hour and one-hour crossings.
17. [ ] Web Push on Android; measure whether native is still wanted.

**Phase 5 — native, only if §9.2 and §9.3 justify it:**

18. [ ] **First: verify `Intl.DateTimeFormat` with an IANA `timeZone` on a physical
    device.** Everything else depends on it. (§8.3)
19. [ ] Expo app importing `domain/**` and `app/clock.ts` unchanged; run the existing
    test suite against them.
20. [ ] Rebuild the screens; `expo-blur`, `expo-haptics`, `expo-notifications`,
    `expo-location`.

---

## 14. Decision summary

**Yes — web and phone would share one set of data over the internet, and the design
already anticipated it.** The overlay model in `DATA_MODEL.md` is conflict-free by
construction, and the purity rule in `CLAUDE.md` means roughly 60% of the code moves to
a native client untouched.

Three things must be fixed first, two of which are bugs today: relative deadlines must
become stored instants, ids must become UUIDs, and surrender counts must become rows.

Supabase over Firebase, because the data is relational and RLS is one line per table.
Web-plus-manifest before native, because the ratio of effort to benefit is an order of
magnitude better — and because background notifications and real location, the two
things only native can deliver, are worth measuring against something shipped.
