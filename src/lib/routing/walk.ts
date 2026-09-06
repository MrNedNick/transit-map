import type { Stop } from '../gtfs/types';

/** Metres per second on foot — the pace an average person actually keeps. */
export const WALK_SPEED = 1.35;

/** How far a transfer on foot is worth walking between two stops. */
export const TRANSFER_RADIUS = 400;

const EARTH_METRES_PER_DEGREE = 111_320;

/** Metres per degree of longitude at a given latitude. */
export function lonScale(lat: number): number {
  return EARTH_METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180);
}

/**
 * Flat-earth distance in metres. The city fits in a few tens of kilometres,
 * where the error against a great circle is far below the precision that a
 * walking-speed estimate deserves.
 */
export function metresBetween(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  scale = lonScale((a.lat + b.lat) / 2),
): number {
  const dx = (a.lon - b.lon) * scale;
  const dy = (a.lat - b.lat) * EARTH_METRES_PER_DEGREE;
  return Math.hypot(dx, dy);
}

export interface Transfer {
  to: number;
  seconds: number;
}

/**
 * Walking links between stops that are close enough to change between. Built
 * over a uniform grid so the whole set costs one pass rather than comparing
 * every stop with every other one.
 */
export function buildTransfers(stops: Stop[]): Transfer[][] {
  const transfers: Transfer[][] = stops.map(() => []);
  if (!stops.length) return transfers;

  const scale = lonScale(stops[0].lat);
  const cellLat = TRANSFER_RADIUS / EARTH_METRES_PER_DEGREE;
  const cellLon = TRANSFER_RADIUS / scale;
  const buckets = new Map<string, number[]>();

  const key = (row: number, col: number) => `${row}:${col}`;
  const cellOf = (stop: Stop) => ({
    row: Math.floor(stop.lat / cellLat),
    col: Math.floor(stop.lon / cellLon),
  });

  stops.forEach((stop, index) => {
    const { row, col } = cellOf(stop);
    const bucket = buckets.get(key(row, col));
    if (bucket) bucket.push(index);
    else buckets.set(key(row, col), [index]);
  });

  stops.forEach((stop, index) => {
    const { row, col } = cellOf(stop);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        for (const other of buckets.get(key(row + dr, col + dc)) ?? []) {
          if (other === index) continue;
          const metres = metresBetween(stop, stops[other], scale);
          if (metres > TRANSFER_RADIUS) continue;
          transfers[index].push({ to: other, seconds: metres / WALK_SPEED });
        }
      }
    }
  });

  return transfers;
}
