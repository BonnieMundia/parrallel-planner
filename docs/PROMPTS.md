# Prompts

One per build step. Paste as-is. Each ends with a stop so the work can be reviewed and committed.

Prefix every session with a fresh `claude` in the repo root — `CLAUDE.md` loads automatically.

---

## 0 — Orientation (do not skip)

> Read `design_handoff_parallel_planner/START_HERE.md`, `BUILD_SETUP.md`, `DATA_MODEL.md` and `SCREENS.md` in full, then open `design_handoff_parallel_planner/design/Parallel Planner iOS.dc.html` and read the logic class at the bottom (from `class Component extends DCLogic`). Don't write any code yet. Tell me back: the three task rules, the ordering rule for each of the three Today columns, and what you'd scaffold first.

---

## 1 — Scaffold

> Do Step 1 from BUILD_SETUP.md. Scaffold Vite + React + TypeScript with strict mode on, the folder structure listed in that doc (empty files are fine), `vercel.json` with the SPA rewrite, and a test runner wired to `npm test`. No UI yet beyond a blank shell that renders. Stop when `npm run dev` serves and `npm run typecheck` passes.

## 2 — Domain types and seed

> Do Step 2. Write `src/domain/types.ts` from the interfaces in DATA_MODEL.md exactly — a task carries exactly one rule's fields, don't flatten them. Then `src/domain/seed.ts` importing `sample_data.json` (copy it into `src/domain/`) and typing it. Add a test asserting 22 tasks, 7 places, 5 streams, and that every task's `rule` matches which optional fields it carries. Stop.

## 3 — Selectors and clock

> Do Step 3. Write `src/domain/select.ts` and `src/app/clock.ts` implementing every function in the "Derived logic" table in DATA_MODEL.md, plus the three ordering rules. All pure functions of `(state, now)` — no React, no `Date.now()` inside them, `now` is always passed in. Then unit tests: urgency tiers at the boundaries, `dueOf` for both `at` and `h` forms, `nextActive` with a skip and with an ended series, the trip total against a hand-worked example, and the streak. Stop.

## 4 — Tokens and primitives

> Do Step 4. Write `src/ui/tokens.ts` with every value in DESIGN_TOKENS.md — colors, ink, type scale, radii, spacing, shadows, motion timings, haptic durations. Then the primitives: Card (frosted, hover lift), Pill, Tick (the 19 px check circle), CountdownBar, SheetModal (scrim + slide-up), Toast. Build a scratch route that renders one of each so I can eyeball them. Stop.

## 5 — Desktop Today

> Do Step 5, following SCREENS.md § Desktop. Build the sidebar, top bar, the three Today columns, and the right rail. Use the seed data and the selectors from step 3 — no hardcoded strings that should come from data, and no invented copy. Match at 1440×900. Interactions in scope: tab switching, stream hover, expanding a clock row, ticking done, delete, the done collapsible. Capture, place picker, focus and notifications come later — wire their buttons to no-ops. Stop.

## 6 — Desktop Week, Deadlines, Zones

> Do Step 6. Build the remaining three desktop tabs per SCREENS.md: Week (7-day block grid + review strip with streak and per-stream completion), Deadlines (flat clock-locked list, soonest first), Zones (each remote deadline laid onto the user's own working day). Reuse the primitives and selectors. Stop.

## 7 — Phone screens

> Do Step 7. Build the phone layout at 412×892 per SCREENS.md § Phone: header, scrolling content, 4-tab bottom bar, floating capture button, and the Now / Due / Week / Streams screens. Minimum 44 px hit targets, 104 px bottom padding under content. Share selectors with desktop; only the presentation differs. Stop.

## 8 — Capture, places, focus, notifications

> Do Step 8. Build the four overlays per SCREENS.md § Overlays: capture sheet (title, rule, stream, place, time, repeat — with the place field dimming when the rule isn't "place"), place picker with add-a-place, focus overlay with a 90 min timer, and the notification tray with the real Notification permission prompt. Wire every action from the DATA_MODEL Actions list, including skip/end/resume and receipt confirmation, and persist to `localStorage` under `parallelPlanner.ios.v2` — durable keys only, transient UI rehydrates to defaults. Stop.

## 9 — Motion and haptics

> Do Step 9. Add every animation in DESIGN_TOKENS.md § Motion with the exact timings, the hover transitions, the urgency animations tied to the tier from `urgency()`, and the haptic buzz on every action at the listed durations (wrapped in try/catch). Add the single shared ticker from DATA_MODEL § The clock — 1 s inside an hour, 20 s otherwise — including the one-time buzz and toast when a deadline crosses the hour line. Honor `prefers-reduced-motion` for every looping animation. Stop.

## 10 — Deploy

> Do Step 10. Verify `npm run build` is clean, then walk me through connecting the repo to Vercel with the Vite preset and `dist/` output. After it's live, confirm the notification permission prompt works over HTTPS and that a deep link doesn't 404.

---

## Useful mid-build prompts

**When something drifts from the design:**
> Compare your <component> against SCREENS.md and DESIGN_TOKENS.md line by line and list every difference — sizes, colors, copy, spacing. Don't fix anything yet, just list them.

**When it invents copy:**
> The copy in the prototype is final. Find every string in <file> that isn't in SCREENS.md or the prototype HTML and replace it with the real one.

**Before a commit:**
> Run typecheck and tests, then summarize what changed in this step in three lines for a commit message.
