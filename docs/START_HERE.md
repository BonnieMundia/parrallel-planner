# Start here

## 1. Put the bundle in a fresh project folder

```bash
mkdir parallel-planner && cd parallel-planner
# unzip this bundle here, then:
cp design_handoff_parallel_planner/CLAUDE.md .
git init
```

`CLAUDE.md` must sit at the **repo root** — that is where Claude Code picks it up automatically every session.

## 2. Start Claude Code and make it read before it writes

```bash
claude
```

First message — do not skip this:

> Read `design_handoff_parallel_planner/START_HERE.md`, `BUILD_SETUP.md`, `DATA_MODEL.md` and `SCREENS.md` in full, then open `design_handoff_parallel_planner/design/Parallel Planner iOS.dc.html` and read the logic class at the bottom (from `class Component extends DCLogic`). Don't write any code yet. Tell me back: the three task rules, the ordering rule for each of the three Today columns, and what you'd scaffold first.

Two minutes of checking catches a wrong mental model before it becomes 2,000 lines. The prototype's runtime is unusual and you want to be sure it understood the HTML is a reference, not a thing to port.

## 3. Build one step per session

Steps are in `BUILD_SETUP.md`; ready-made prompts are in `PROMPTS.md`. Each step is demoable on its own:

1. Scaffold + Vercel config
2. Domain types + seed data
3. Selectors and clock math (pure, unit-testable)
4. Tokens + primitives
5. Desktop Today
6. Desktop Week / Deadlines / Zones
7. Phone Now / Due / Week / Streams
8. Capture, places, focus, notifications
9. Motion and haptics pass
10. Deploy

Resist asking for the whole app in one prompt. Desktop Today alone is dense enough that a single-shot attempt will drift from the spec.

## 4. Commit after every step

```bash
git add -A && git commit -m "step 3: selectors"
```

So a bad step costs you one `git reset`, not an afternoon.

## Reading order for the docs

| When | Read |
|---|---|
| Before anything | START_HERE, README |
| Steps 1–3 | BUILD_SETUP, DATA_MODEL, sample_data.json |
| Steps 4–8 | SCREENS, DESIGN_TOKENS |
| Any time | PROMPTS |
