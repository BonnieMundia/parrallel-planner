# Parallel Planner

A planner for someone running several parallel commitments. Every task is governed by exactly one of three rules, and the entire product exists to keep them visually and structurally separate:

- **clock** — someone else set the time, usually in another timezone
- **place** — it only happens somewhere
- **none** — nobody is waiting; it only happens if the user defends time for it

Design spec lives in `design_handoff_parallel_planner/`. Read `SCREENS.md` and `DESIGN_TOKENS.md` before touching UI, `DATA_MODEL.md` before touching logic.

## Stack

React + TypeScript + Vite. CSS Modules. `useReducer` + context for state — no Redux, no data-fetching library, no backend. Persistence is `localStorage` under `parallelPlanner.ios.v2`. Hosted static on Vercel.

## Rules

- **The HTML in `design/` is a reference, not code to port.** It runs on a bespoke template runtime (`support.js`, `<x-dc>`, `{{ holes }}`). Never copy that runtime, its tags, or its `.dc.html` structure into `src/`. Read it to learn intent, then write idiomatic React.
- **Copy is final.** Every string in the prototype was written deliberately. Reproduce it verbatim. Do not "improve" microcopy, do not add helper text, do not add empty-state copy that isn't specified.
- **Design tokens are final.** Use the values in `DESIGN_TOKENS.md` exactly — no new colors, no rounded-up spacing, no substituted fonts. If something isn't in the token list, ask rather than invent.
- **Dark only.** There is no light theme. Do not add one.
- **No new dependencies without asking.** No UI kit, no date library, no animation library, no icon pack. Date math is small and hand-written; the one mark is inline SVG.
- **No emoji anywhere in the UI.**
- Selectors in `src/domain/select.ts` must be pure functions of `(state, now)` and unit-testable without React.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on every countdown, clock, and count.
- Minimum hit target 44 px on phone layouts.
- Respect `prefers-reduced-motion` for every animation.

## Scope discipline

Do only what the current step asks. If you spot something worth changing outside that scope, say so and wait — do not fold it in. Stop at the end of each step so the work can be reviewed and committed.

## Commands

```bash
npm run dev        # local
npm run build      # production build to dist/
npm run typecheck
npm test           # selectors
```

## Definition of done, per screen

Matches the prototype at the specified viewport (1440×900 desktop, 412×892 phone), all listed interactions work, no console errors, no TypeScript `any`, keyboard reachable, and copy matches character for character.
