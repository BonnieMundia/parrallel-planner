import { describe, expect, it } from 'vitest';
import { laneStyle, packLanes } from './dayLayout';

const at = (top: number, h: number, id = `${top}`) => ({ top, h, id });

describe('packLanes', () => {
  it('gives blocks that never touch the full width', () => {
    const out = packLanes([at(0, 30), at(60, 30), at(120, 30)]);
    expect(out.map((b) => [b.lane, b.lanes])).toEqual([
      [0, 1],
      [0, 1],
      [0, 1],
    ]);
  });

  it('splits two overlapping blocks into two lanes', () => {
    const out = packLanes([at(0, 40), at(20, 40)]);
    expect(out.map((b) => b.lane)).toEqual([0, 1]);
    expect(out.every((b) => b.lanes === 2)).toBe(true);
  });

  it('reuses a lane once the block above it has ended', () => {
    // At an equal top the shorter block sorts first and takes lane 0; the block
    // starting at 50 then reuses that lane, because the one in it ended at 40.
    const out = packLanes([at(0, 100, 'long'), at(0, 40, 'a'), at(50, 40, 'b')]);
    const lane = (id: string) => out.find((b) => b.id === id)?.lane;
    expect(lane('a')).toBe(0);
    expect(lane('long')).toBe(1);
    expect(lane('b')).toBe(0);
    expect(out.every((b) => b.lanes === 2)).toBe(true);
  });

  it('treats blocks that merely touch as separate clusters', () => {
    const out = packLanes([at(0, 35), at(35, 35)]);
    expect(out.every((b) => b.lanes === 1)).toBe(true);
  });

  it('keeps clusters independent, so one overlap does not narrow the whole day', () => {
    const out = packLanes([at(0, 40), at(20, 40), at(200, 30)]);
    expect(out.find((b) => b.top === 200)?.lanes).toBe(1);
  });

  it('sorts by top, then by height, whatever order it is given', () => {
    const out = packLanes([at(120, 30), at(0, 60), at(0, 20)]);
    expect(out.map((b) => [b.top, b.h])).toEqual([
      [0, 20],
      [0, 60],
      [120, 30],
    ]);
  });

  it('never drops a block', () => {
    const input = [at(0, 100), at(10, 20), at(15, 20), at(40, 90), at(300, 10)];
    expect(packLanes(input)).toHaveLength(input.length);
  });
});

describe('laneStyle', () => {
  it('places a single-lane block against the full track', () => {
    expect(laneStyle({ lane: 0, lanes: 1 }, 36, 36)).toEqual({
      left: 'calc(36px + 0.0000 * (100% - 36px))',
      width: 'calc((100% - 36px) / 1 - 2px)',
    });
  });

  it('offsets the second of two lanes by half the track', () => {
    expect(laneStyle({ lane: 1, lanes: 2 }, 36, 36).left).toBe(
      'calc(36px + 0.5000 * (100% - 36px))',
    );
  });
});
