import { SEED_STREAMS } from '../domain/seed';
import type { Stream } from '../domain/types';

const BY_NAME = new Map(SEED_STREAMS.map((s) => [s.name, s]));

/** Stream colours come from the seed, which carries its own. */
export function streamColor(name: Stream): string {
  return BY_NAME.get(name)?.color ?? '#FF5C8A';
}

export function streamChipBg(name: Stream): string {
  return BY_NAME.get(name)?.chipBg ?? 'rgba(255,55,95,.2)';
}

/** A picked stream dims everything not in it. */
export function streamFade(picked: Stream | null, name: Stream): number {
  return picked && picked !== name ? 0.34 : 1;
}
