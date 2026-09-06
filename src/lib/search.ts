import type { Stop } from './gtfs/types';

export interface SearchHit {
  stop: Stop;
  score: number;
}

/**
 * Substring matching over ~4 000 stops, ranked so that a name that starts with
 * the query beats one that merely contains it. Fast enough to run on every
 * keystroke without debouncing.
 */
export function searchStops(stops: Stop[], query: string, limit = 12): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const hits: SearchHit[] = [];
  for (const stop of stops) {
    const name = stop.name.toLowerCase();
    let score = -1;
    if (name.startsWith(needle)) score = 0;
    else {
      const at = name.indexOf(needle);
      if (at > 0) score = 1 + at / 100;
      else if (stop.district.toLowerCase().startsWith(needle)) score = 3;
    }
    if (score >= 0) {
      hits.push({ stop, score });
      if (hits.length > limit * 12) break;
    }
  }

  hits.sort((a, b) => a.score - b.score || a.stop.name.localeCompare(b.stop.name));
  return hits.slice(0, limit);
}
