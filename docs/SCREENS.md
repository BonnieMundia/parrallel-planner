# Screens

Two artifacts in the prototype: `#3a` desktop at 1440×900, `#3b` phone at 412×892. Both dark only.

---

# Desktop — three-pane, 1440 × 900

## Left sidebar — 252 px

`rgba(17,24,27,.6)` + `blur(30px) saturate(1.4)`, right border `rgba(255,255,255,.07)`, padding `18px 0 14px`.

- App mark (24 px, radius 7) + "Parallel", 700/17px, `-.02em`.
- **Where am I** — label 590/12px at `.55` opacity, then a button: green dot, current place name (590/13.5px), sub-note (11.5px), `▾`. Opens the place picker.
- **Streams** — one row per stream: 22 px rounded swatch holding an 8 px colored dot, name 14px `-.01em`, governing rule beneath at 11.5px, count right-aligned and tabular. Hover `rgba(110,128,132,.2)`.
- Spacer, then a pinned **Defended** card: label + green value, 6 px progress bar, one note line.

## Top bar — 56 px

`rgba(15,21,24,.55)` + `blur(28px) saturate(1.4)`, bottom hairline.

Left: segmented control **Today · Week · Deadlines · Zones** — 2 px inset track `rgba(110,128,132,.24)`, radius 9, active pill white background with `0 1px 3px rgba(0,0,0,.35)`.

Right, in order: current-place pill (green, `rgba(53,214,160,.16)`) · `Nairobi HH:MM:SS` tabular · bell button 34×34 with a red `#F5405E` count badge · **+ Capture** button `#E85E42`, hover `#FF7A5C` + `translateY(-1px)`.

## Today

Header: eyebrow (`#FF9E86`, 590/12px, uppercase, `.05em`), date 700/34px `-.028em`, then one summary line — "N clock-locked · 1 lands after your last block · N live where you are · N waiting across N places". Right: a 210 px "Committed 9.5 of 15 h" bar, segmented by stream color.

Then three equal columns, `gap: 18px`.

### 1. Locked to a clock

Header: 9 px `#FF7A5C` dot, "Locked to a clock", count.

One frosted card, rows separated by hairlines. Each row:

- Tick circle (19 px, 1.5 px border, hover fills `#35D6A0` with a dark ✓), title 15px `-.012em`, stream dot, delete `×` (hover `rgba(245,64,94,.22)`).
- Countdown 600/24px `-.03em` tabular + unit beside it.
- 5 px progress bar in the urgency color.
- Footer line: your clock left, theirs right.
- If the deadline lands while asleep: an amber strip with a blinking dot — "It closes while you are asleep."

Click expands an inset panel `rgba(11,16,19,.5)`: notes paragraph, then a 2×2 grid — **Their clock** (time + city), **Your clock**, **Stream** (+ percentage), **If it slips** — then "Set by X", **Confirm you received this**, **Focus 90 min**.

Past due adds a red band: "Its time has passed. It will not move on its own." with **Take the HH:MM slot** and **Leave it**.

Below the card: the "✓ N done" collapsible, then the note "Someone else set the time, in their zone. Every clock here is EAT. Click one for the detail."

### 2. Locked to a place

Header: 9 px `#F0A93B` dot, "Locked to a place", count.

Optional **one-trip bundle** card at the top, amber `rgba(240,169,59,.12)`: label + total, one row per stop ("2 items · 60 min there · 12 min out"), then "Leave now, back by HH:MM · 25 min to the far end" and a **Plan the trip** button.

Then one card per place. Colored header (7 px dot, name, status right). Rows: tick, title 14.5px, time + countdown (red when hot, grey when "No set time"), meta line, leave-by line with a dot, and for repeats a teal `Weekly` chip plus **Skip this week** and **End series**.

Ended series collect in a grey card with a **Resume** button per row. Then the done collapsible, then "Soonest first, across every place. Only the one you are standing in is live."

### 3. Locked to nothing

Header: 9 px `#35D6A0` dot, "Locked to nothing", count.

A green summary card (`rgba(53,214,160,.14)`): label, value 600/17px, 6 px bar, note. Then a card of rows: tick, title, staleness counter ("11 d untouched"), delete; sub-line; a full-width **Defend** button. Closing note: "No client, no date. It only happens if you defend it."

## Right rail — 300 px

`rgba(13,19,22,.5)` + `blur(26px)`, left hairline.

"Today, laid out" 700/19px, "06–23" right. Timeline 595 px tall: hour rules at `rgba(255,255,255,.06)` with 11px tabular labels, blocks absolutely positioned and colored by stream, hatched when unclaimed. Hover `translateY(-2px) scale(1.014)` + `0 12px 26px rgba(0,0,0,.5)`.

## Week

Seven day columns of the same blocks, plus a review strip: a 150 px streak card ("3 days in a row" 700/20px + note) and a 5-column per-stream completion grid.

## Deadlines

Every clock-locked item, flat, soonest first, countdown-led. No grouping.

## Zones

Each remote deadline laid onto the user's own working day, so a 09:00 Berlin call reads as 10:00 EAT against their own blocks. This is the screen that answers "when does their deadline actually land in my day".

---

# Phone — 412 × 892

Status bar · header (place chip, bell) · scrolling content · 4-tab bottom bar · floating capture button.

Bottom nav: **Now · Due · Week · Streams**, active `#FF9E86`, inactive `rgba(233,240,240,.5)`. Content padding-bottom 104 px to clear it. Minimum hit target 44 px.

### Now
Hero card for the single next thing — title, countdown, **Start 90 min** and **Push to this evening**. Then the live place group, then anything inside 8 hours.

### Due
Clock-locked list, countdown-led, same rows as desktop column 1 in compact form.

### Week
Compressed day columns plus the review strip.

### Streams
A count line — "6 on a clock · 8 on a place · 8 on nothing" — then grouped lists.

---

# Overlays

## Bottom sheets
Slide up with `ppSheet` (`.34s cubic-bezier(.2,.9,.3,1)`) over a `rgba(0,0,0,.6)` + `blur(3px)` scrim. Surface `rgba(27,36,40,.92)` + `blur(34px) saturate(1.6)`, radius `24px 24px 0 0`.

**Place picker** — every place with a dot, name, sub-line, and a green ✓ on the current one. Footer: "Add a place…" field + **Add**. Adding switches to the new place immediately.

**Capture** — title field → rule (A clock / A place / Nothing, each with a sub-line and its color) → stream → place → time → repeat (once / weekly + day). The place field dims to `.4` opacity when the rule isn't "place". Saving buzzes 16 ms, closes, toasts "Added — locked to <place>", and flashes the new row with `ppPop`.

## Focus overlay
Full-screen takeover — task title, large tabular countdown, pause/resume, stop. 90 min default. Completion buzzes `[20,90,20,90,20]` and posts a notification.

## Notification tray
Last 14 entries, each with a colored dot, title, body, and time. A permission prompt appears until granted; once granted, real system notifications fire alongside.

## Toasts
Bottom center, `ppToast` in, held 2700 ms, `ppToastOut`, removed at 3160 ms. Title + one line, colored by event type.
