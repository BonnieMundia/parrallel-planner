# Parallel Planner — design handoff

A planner for someone running several parallel commitments — paid contract work, dissertation writing, applications, errands, and personal engineering projects — where every item is governed by exactly one of three rules:

- **Clock-locked** — someone else set the time, usually in another timezone.
- **Place-locked** — it only happens somewhere (town, supermarket, church, gym, parents').
- **Locked to nothing** — nobody is waiting; it only happens if the user defends time for it.

The product's whole argument is that these three kinds of work must not sit in one undifferentiated list. Everything in this bundle serves that.

## What's here

| File | What it is |
|---|---|
| **START_HERE.md** | Read this first. Order of work, the opening prompt, rules of engagement. |
| **CLAUDE.md** | Persistent project rules. Copy to the repo root — Claude Code loads it every session. |
| **BUILD_SETUP.md** | Stack, folder scaffold, commands, Vercel deploy. |
| **DATA_MODEL.md** | Types, derived logic, state shape, persistence. |
| **SCREENS.md** | Every screen and component, desktop and phone. |
| **DESIGN_TOKENS.md** | Colors, type, spacing, radii, shadows, motion, haptics, icon. |
| **PROMPTS.md** | Copy-paste prompts, one per build step. |
| **sample_data.json** | Seed data — 22 tasks, 7 places, 5 streams, a week of blocks. |
| **design/** | The HTML prototypes. Reference only. |

## About the design files

`design/` contains **design references, not production code**. They are HTML prototypes showing intended look, motion, and behavior. Open `design/Parallel Planner iOS.dc.html` in a browser and click through it before writing anything.

They use a bespoke template runtime (`support.js`, `<x-dc>`, `{{ holes }}`, `<sc-for>`, `<sc-if>`). **Do not port that runtime.** Rebuild the screens in the target codebase's own environment and patterns.

The one file worth reading closely is the logic class at the bottom of the `.dc.html` (from `class Component extends DCLogic`, line ~1049). It holds the seed data, the countdown and urgency math, the trip planner, and every state transition. Lift the logic; leave the rendering.

Inside the HTML: `#3a` is the desktop artifact (1440×900), `#3b` the phone (412×892).

## Fidelity

**High fidelity.** Colors, type, spacing, radii, motion timings, and copy are final. Recreate them exactly, using the codebase's existing component library where one exists. All copy in the prototype is intentional — keep it verbatim unless a product owner says otherwise.

## Known gaps

The prototype states two honest limits at the bottom of its page, and neither is solved: there is no real location awareness (current place is picked by hand), and no server, so nothing syncs between devices. Both need a decision before a real build.

On Vercel the second is a fork in the road later, not a blocker now: cross-device sync, accounts, or push notifications that fire while the app is closed all mean adding a database and serverless routes (Vercel Postgres, Supabase, or Neon), at which point the deploy stops being purely static. That is an addition to the static launch, not a rewrite of it.
