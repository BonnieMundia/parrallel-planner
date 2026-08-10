import { describe, expect, it } from 'vitest';
import { HAPTIC, INK, PALETTE, RULE_COLOR, URGENCY_COLOR, urgencyAnimation } from './tokens';
import { SEED_STREAMS } from '../domain/seed';

describe('tokens name custom properties rather than repeating hexes', () => {
  it('spells no colour out, so tokens.css cannot drift from tokens.ts', () => {
    for (const [name, value] of [...Object.entries(PALETTE), ...Object.entries(INK)]) {
      expect(value, name).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
  });

  it('maps each rule to the colour DESIGN_TOKENS gives it', () => {
    expect(RULE_COLOR).toEqual({
      clock: 'var(--contract)',
      place: 'var(--workshop)',
      none: 'var(--build)',
    });
  });

  it('leaves stream colours to the seed, which carries its own', () => {
    expect(SEED_STREAMS.map((s) => s.color)).toEqual([
      '#FF7A5C',
      '#B08CFF',
      '#35D6A0',
      '#FF5C8A',
      '#4FD1C5',
    ]);
  });
});

describe('urgency', () => {
  it('is white until eight hours, amber inside them, red inside the hour and past', () => {
    expect(URGENCY_COLOR[0]).toBe(INK.primary);
    expect(URGENCY_COLOR[1]).toBe(PALETTE.workshop);
    expect(URGENCY_COLOR[2]).toBe(PALETTE.alarm);
    expect(URGENCY_COLOR[3]).toBe(PALETTE.alarm);
  });

  it('animates nothing until eight hours, then pulses, shakes and glows', () => {
    expect(urgencyAnimation(0)).toBe('none');
    expect(urgencyAnimation(1)).toContain('ppPulse');
    expect(urgencyAnimation(2)).toContain('ppShake');
    expect(urgencyAnimation(2)).toContain('ppHot');
    expect(urgencyAnimation(3)).toBe('ppHot 3s ease-in-out infinite');
  });
});

describe('haptics', () => {
  it('carries the patterns DESIGN_TOKENS specifies', () => {
    expect(HAPTIC.tap).toBe(8);
    expect(HAPTIC.complete).toBe(16);
    expect(HAPTIC.focusStart).toBe(20);
    expect(HAPTIC.crossedHour).toEqual([18, 60, 18]);
    expect(HAPTIC.focusComplete).toEqual([20, 90, 20, 90, 20]);
  });
});
