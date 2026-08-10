/**
 * Overlapping blocks share the column instead of covering each other. Pure geometry:
 * given tops and heights, it packs each cluster of overlaps into the fewest lanes and
 * says how many lanes that cluster ended up needing.
 */

export interface Placed {
  top: number;
  h: number;
}

export interface Laned {
  /** 0-based column within the cluster. */
  lane: number;
  /** How many columns this block's cluster was split into. */
  lanes: number;
}

/**
 * Blocks are swept top down. A cluster runs until a gap appears, and inside it a block
 * takes the first lane that has already ended — so a short block can reuse the lane of
 * one that finished above it.
 */
export function packLanes<T extends Placed>(items: readonly T[]): (T & Laned)[] {
  const sorted = [...items].sort((a, b) => a.top - b.top || a.h - b.h);
  const out: (T & Laned)[] = [];

  let i = 0;
  while (i < sorted.length) {
    let j = i;
    let end = (sorted[i]?.top ?? 0) + (sorted[i]?.h ?? 0);
    // Half a pixel of slack, so blocks that merely touch are not treated as overlapping.
    while (j + 1 < sorted.length && (sorted[j + 1]?.top ?? 0) < end - 0.5) {
      j++;
      end = Math.max(end, (sorted[j]?.top ?? 0) + (sorted[j]?.h ?? 0));
    }

    const cluster = sorted.slice(i, j + 1);
    const laneEnds: number[] = [];
    const laned = cluster.map((item) => {
      let lane = laneEnds.findIndex((e) => e <= item.top + 0.5);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.top + item.h;
      return { ...item, lane, lanes: 0 };
    });

    const lanes = Math.max(1, laneEnds.length);
    for (const item of laned) out.push({ ...item, lanes });
    i = j + 1;
  }

  return out;
}

/** Where a laned block sits, as CSS calc() against the track's own width. */
export function laneStyle(
  item: Laned,
  base: number,
  inset: number,
): { left: string; width: string } {
  return {
    left: `calc(${base}px + ${(item.lane / item.lanes).toFixed(4)} * (100% - ${inset}px))`,
    width: `calc((100% - ${inset}px) / ${item.lanes} - 2px)`,
  };
}
