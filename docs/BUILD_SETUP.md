# Build setup

## Stack

**React + TypeScript + Vite**, CSS Modules (or Tailwind if the target repo already uses it). State is local and modest — one `useReducer` plus context is enough. No Redux, no server, no data-fetching library.

Nothing needs a backend to demo. Persistence is `localStorage` under key `parallelPlanner.ios.v2`.

Mobile, if it becomes a real app rather than a responsive web view: React Native / Expo, or SwiftUI if iOS-only, mapping the same domain model.

## Hosting — Vercel

Static SPA. Connect the repo, framework preset **Vite**, build `npm run build`, output `dist/`. No serverless functions, no env vars, no database.

Two things to get right:

**HTTPS is load-bearing.** The Notification API and `navigator.vibrate` are secure-origin only. Vercel gives you TLS by default; a plain-HTTP host would silently break both features.

**SPA rewrite,** so deep links don't 404:

```json
// vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Because state lives in `localStorage`, each browser is its own island — the phone and the desktop do not share data. Acceptable for launch; see Known gaps in README.

## Scaffold

```
src/
  app/
    App.tsx                  # shell: desktop layout vs phone layout
    store.ts                 # reducer, actions, persistence
    clock.ts                 # ticking now, timezone math, countdown formatting
  domain/
    types.ts                 # Task, Place, Stream, Rule
    seed.ts                  # loaded from sample_data.json
    select.ts                # derived: byRule, dueOf, urgency, placeGroups, trip, week
  ui/
    tokens.ts                # colors, spacing, radii, type scale, motion
    primitives/              # Card, Pill, Tick, CountdownBar, SheetModal, Toast
  screens/
    desktop/  Today.tsx Week.tsx Deadlines.tsx Zones.tsx
    phone/    Now.tsx Due.tsx Week.tsx Streams.tsx
  features/
    capture/  CaptureSheet.tsx
    places/   PlacePicker.tsx
    focus/    FocusOverlay.tsx
    notify/   NotificationTray.tsx
```

## Step order

Each step is demoable and independently committable.

| # | Step | Done when |
|---|---|---|
| 1 | Scaffold, `vercel.json`, strict tsconfig, test runner | `npm run dev` serves a blank shell |
| 2 | `domain/types.ts` + `seed.ts` from `sample_data.json` | Types compile, seed loads, 22 tasks present |
| 3 | `select.ts` + `clock.ts` with unit tests | Countdown, urgency tiers, ordering, trip total all tested |
| 4 | `tokens.ts` + primitives | Card, Pill, Tick, CountdownBar, SheetModal, Toast render in isolation |
| 5 | Desktop Today | Three columns, right rail, top bar, sidebar — matches at 1440×900 |
| 6 | Desktop Week / Deadlines / Zones | Tab switching works |
| 7 | Phone Now / Due / Week / Streams | Matches at 412×892, 44 px targets |
| 8 | Capture, places, focus, notifications | Adding, deleting, skipping, ending, focus timer all persist |
| 9 | Motion + haptics pass | Every animation in DESIGN_TOKENS present, reduced-motion honored |
| 10 | Deploy | Live on Vercel, notification prompt works over HTTPS |

## Commands

```bash
npm create vite@latest . -- --template react-ts
npm install
npm run dev
npm run build          # → dist/
npm run typecheck
npm test
```

Commit after every step.
