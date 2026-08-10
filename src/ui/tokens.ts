/**
 * The half of DESIGN_TOKENS.md that JavaScript reaches for — colors chosen at runtime,
 * animation strings, timings, buzz patterns.
 *
 * No hex value is written here. tokens.css is the only place a token colour is spelled
 * out; this file names the custom properties, which inline styles accept as-is. That
 * makes the two files incapable of drifting apart rather than merely tested for it.
 * Stream colours are the one exception, and they are not here either — they come from
 * the seed, which carries its own.
 */

import type { Rule } from '../domain/types';
import type { Urgency } from '../app/clock';

export const PALETTE = {
  contract: 'var(--contract)',
  writing: 'var(--writing)',
  workshop: 'var(--workshop)',
  build: 'var(--build)',
  self: 'var(--self)',
  life: 'var(--life)',
  alarm: 'var(--alarm)',
} as const;

export const INK = {
  primary: 'var(--ink)',
  green: 'var(--green-ink)',
  amber: 'var(--amber-ink)',
  alarm: 'var(--alarm-ink)',
  alarmStrong: 'var(--alarm-ink-2)',
  teal: 'var(--teal-ink)',
  link: 'var(--link)',
  linkHover: 'var(--link-hover)',
  cta: 'var(--cta)',
  ctaHover: 'var(--cta-hover)',
  onBuild: 'var(--on-build)',
} as const;

export const RULE_COLOR: Record<Rule, string> = {
  clock: PALETTE.contract,
  place: PALETTE.workshop,
  none: PALETTE.build,
};

/** calm · inside 8 h · inside 1 h · past. */
export const URGENCY_COLOR: Record<Urgency, string> = {
  0: INK.primary,
  1: PALETTE.workshop,
  2: PALETTE.alarm,
  3: PALETTE.alarm,
};

/**
 * The looping animation an urgent row carries.
 *
 * `both` is load-bearing under reduced motion, not decoration: the global reset
 * collapses every animation to one 0.01ms iteration, so without a fill mode the red
 * inset bar on a past-due row would flash and vanish. With it, the final keyframe
 * holds — which is the whole point of "the urgency colors carry the meaning on their
 * own". motion.css redefines the keyframes there so nothing actually moves.
 */
export function urgencyAnimation(tier: Urgency): string {
  switch (tier) {
    case 3:
      return 'ppHot 3s ease-in-out infinite both';
    case 2:
      return 'ppShake 5s ease-in-out infinite both, ppHot 1.7s ease-in-out infinite both';
    case 1:
      return 'ppPulse 2.8s ease-in-out infinite both';
    default:
      return 'none';
  }
}

/**
 * What a list row animates with. A row that just landed pops once; otherwise it
 * carries its urgency. The flash wins — a new row arriving is the more important
 * event, and it is over in 480ms.
 */
export function rowAnimation(flash: string | null, id: string, tier: Urgency = 0): string {
  return flash === id ? ANIM.pop : urgencyAnimation(tier);
}

export const ANIM = {
  pop: 'ppPop .48s cubic-bezier(.2,.9,.3,1.15) both',
  sheet: 'ppSheet .34s cubic-bezier(.2,.9,.3,1) both',
  toastIn: 'ppToast .44s cubic-bezier(.2,.9,.3,1.1) both',
  toastOut: 'ppToastOut .42s ease forwards',
  /** Content entering — a tab or screen taking the stage. */
  fadeUp: 'ppFadeUp .4s cubic-bezier(.2,.8,.3,1) both',
} as const;

/** Staggered entrance, so a list arrives rather than appearing all at once. */
export function fadeUpDelayed(index: number): string {
  return `ppFadeUp .4s ${(index * 0.06).toFixed(2)}s cubic-bezier(.2,.8,.3,1) both`;
}

export const TIMING = {
  /** A toast starts leaving here and is gone here. */
  toastHold: 2700,
  toastGone: 3160,
  /** The added-row flash. */
  flash: 1500,
  /** The greeting shows, starts leaving, and is gone. */
  greetHold: 3200,
  greetGone: 3700,
} as const;

/** navigator.vibrate patterns. Every interactive action buzzes. */
export const HAPTIC = {
  tap: 8,
  undo: 10,
  resume: 10,
  skipOnce: 12,
  receipt: 12,
  addPlace: 12,
  remove: 14,
  move: 14,
  complete: 16,
  addTask: 16,
  endSeries: 16,
  focusStart: 20,
  /** A deadline crossing the one-hour line. */
  crossedHour: [18, 60, 18],
  focusComplete: [20, 90, 20, 90, 20],
} as const satisfies Record<string, number | readonly number[]>;

/** Minimum hit target on phone layouts. */
export const HIT_TARGET = 44;
