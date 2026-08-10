# Design tokens

Dark only. There is no light theme.

## Surface

```
canvas        #070B0D
canvas glow   radial 900×620 at 16% 10%  rgba(255,122,92,.16)
              radial 760×520 at 84% 84%  rgba(176,140,255,.13)
              radial 600×400 at 60% 40%  rgba(53,214,160,.06)

card          rgba(23,31,35,.55) + blur(22px) saturate(1.5)
sidebar       rgba(17,24,27,.6)  + blur(30px) saturate(1.4)
topbar        rgba(15,21,24,.55) + blur(28px) saturate(1.4)
rail          rgba(13,19,22,.5)  + blur(26px)
sheet         rgba(27,36,40,.92) + blur(34px) saturate(1.6)
popover       rgba(27,36,40,.86) + blur(34px) saturate(1.6)
inset panel   rgba(11,16,19,.5)
control fill  rgba(110,128,132,.20 – .32)
scrim         rgba(0,0,0,.6) + blur(3px)

border        rgba(255,255,255,.07)      hover  rgba(255,255,255,.16)
border strong rgba(255,255,255,.14)
```

Every surface is frosted. If the platform can't do `backdrop-filter`, fall back to the same color at full opacity — do not drop to a flat mid-grey.

## Ink

```
primary     #FFFFFF
secondary   rgba(233,240,240,.72)
tertiary    rgba(233,240,240,.58)
quiet       rgba(233,240,240,.55)
faint       rgba(233,240,240,.50)
placeholder rgba(233,240,240,.42)
```

## Color

```
contract   #FF7A5C      writing    #B08CFF      workshop / place  #F0A93B
build      #35D6A0      self       #FF5C8A      life              #4FD1C5
alarm      #F5405E

green ink  #6FE3BA      amber ink  #F7C173      alarm ink  #FFA3B4 / #FF8095
teal ink   #86E4DC      link       #FF9E86  →  hover #FFC0AF
cta        #E85E42  →  hover #FF7A5C
```

Stream → color: Contract `#FF7A5C` · Writing `#B08CFF` · Personal builds `#35D6A0` · Applications `#FF5C8A` · Life & errands `#4FD1C5`.

Rule → color: clock `#FF7A5C` · place `#F0A93B` · none `#35D6A0`.

Urgency → color: calm white · inside 8 h `#F0A93B` · inside 1 h and past `#F5405E`.

## Type

System stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, sans-serif`. No webfont, no substitution.

```
display      700  34/1.1    -.028em     page title
panel title  700  19/1      -.02em      rail heading
brand        700  17/1      -.02em      wordmark
count        600  24/1      -.03em      countdown
stat         600  17/1                  defended value
body         400  15/1.3    -.012em     task titles
list         400  14/1.25   -.01em      list rows
label        590  13/1                  section labels, buttons
meta         400  12.5/1.3              sub-lines, notes
eyebrow      590  12/1      .05em       uppercase kickers
micro        400  11.5/1.2              captions
badge        590  11/1                  chips, ids
```

`font-variant-numeric: tabular-nums` on every countdown, clock, count, and progress figure — non-negotiable, the numbers twitch without it.

`text-wrap: pretty` on all body copy and task titles.

## Radii

```
sheet     24 (top corners only)
window    14        card      14
panel     11–12     pill      11
control   9         chip      6–8
tick      50%       swatch    6
```

## Spacing

`4 · 6 · 8 · 10 · 12 · 16 · 18 · 22 · 32 · 36`

Column gap 18. Card padding `14px 16px`. Sheet padding 13–15. Page padding `44px 48px 56px`.

## Shadows

```
card hover   0 18px 40px rgba(0,0,0,.55)
block hover  0 12px 26px rgba(0,0,0,.5)
popover      0 26px 60px rgba(0,0,0,.65)
window       0 40px 90px rgba(0,0,0,.65)
active pill  0 1px 3px  rgba(0,0,0,.35)
```

## Motion

| Name | Use | Timing |
|---|---|---|
| `ppFadeUp` | content entering | `.4s`, 16 px rise |
| `ppPop` | newly added row | `.48s cubic-bezier(.2,.9,.3,1.15)` |
| `ppSheet` | bottom sheets | `.34s cubic-bezier(.2,.9,.3,1)` |
| `ppToast` / `ppToastOut` | toasts | in `.4s`; out fires at 2700 ms, removed at 3160 ms |
| `ppPulse` | inside 8 h | `2.8s` amber halo, infinite |
| `ppShake` + `ppHot` | inside 1 h | `5s` shake + `1.7s` red glow, infinite |
| `ppHot` | past due | `3s` red inset bar + glow, infinite |
| `blink` | sleep-warning dot | `1.6s` |

Interaction transitions:

```
card hover      transform translateY(-3px), shadow, border
                .18s cubic-bezier(.2,.8,.3,1)
block hover     translateY(-2px) scale(1.014)   .16s
button hover    translateY(-1px)                .16s
background/color changes                        .14 – .18s ease
```

`@media (prefers-reduced-motion: reduce)` neutralizes `ppShake` in the prototype. Extend that to every looping animation — the urgency colors carry the meaning on their own.

## Haptics

`navigator.vibrate` on web, `Haptics` on native. Every interactive action buzzes.

```
tap / open / close        8 ms
undo, resume             10 ms
skip once, receipt,      12 ms
  add place
delete, move             14 ms
complete, add task,      16 ms
  end series
focus start              20 ms
deadline crosses 1 h     [18, 60, 18]
focus complete           [20, 90, 20, 90, 20]
```

Wrap in try/catch — unsupported browsers must fail silently.

## Icon

No bitmaps anywhere. The one mark is inline SVG, 64×64, `rx: 15`:

- Background `#0E1518` (at large sizes, a vertical gradient `#162226 → #0B1013`).
- Three bars, all `height: 8`, `rx: 4`, at `y = 15, 28, 41`, `x = 12`: `#FF7A5C` width 40 · `#F0A93B` width 27 · `#35D6A0` width 16.
- A `#4FD1C5` ring at `(48, 45)`, `r: 5`, `stroke-width: 3`.

Three lanes of different lengths, one per rule, with a place marker beside them. Legible down to 26 px because the shapes differ in length and color, not in detail.

## Scrollbars

8 px, transparent track, thumb `rgba(233,240,240,.2)` radius 4. Phone-frame scrollers hide theirs entirely.
