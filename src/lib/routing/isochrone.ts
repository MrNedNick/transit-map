import type { Network, Timetable } from '../gtfs/feed';
import type { Mode } from '../gtfs/types';
import { contourRings, ringsToPolygons, type Field } from './contour';
import { reachFrom } from './reach';
import { WALK_SPEED, lonScale } from './walk';

/** The contour needs real values a little past the edge to interpolate into. */
const MARGIN_SECONDS = 4 * 60;

/** Cells across the longer side; finer than this only adds wiggle. */
const MAX_CELLS = 260;
const MIN_CELL_METRES = 45;

const METRES_PER_DEGREE = 111_320;

export interface IsochroneOptions {
  hour: number;
  weekday: number;
  modes: Mode[];
  /** Minutes of travel to spend. */
  minutes: number;
}

export interface Isochrone {
  area: GeoJSON.MultiPolygon;
  stopsReached: number;
  /** Square kilometres inside the outline. */
  squareKm: number;
  minutes: number;
  /** Milliseconds spent on the whole thing, search and outline together. */
  millis: number;
}

/**
 * The area someone can get to from a stop within a time budget: how far the
 * network carries them, plus how far they can walk from wherever it drops
 * them off.
 */
export function isochroneFrom(
  network: Network,
  timetable: Timetable,
  originStopId: string,
  options: IsochroneOptions,
): Isochrone | null {
  const started = performance.now();
  const budget = options.minutes * 60;

  const reach = reachFrom(network, timetable, originStopId, { ...options, budget });
  const origin = network.stopById.get(originStopId);
  if (!reach || !origin) return null;

  const scale = lonScale(origin.lat);
  const walkMetres = (seconds: number) => seconds * WALK_SPEED;

  // Every stop the search reached can be walked away from for whatever time is
  // left, and that is what sets how much ground the grid has to cover.
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const sources: Array<{ lon: number; lat: number; cost: number }> = [];
  network.stops.forEach((stop, index) => {
    const cost = reach.costs[index];
    if (cost > budget) return;
    sources.push({ lon: stop.lon, lat: stop.lat, cost });
    const spread = walkMetres(budget - cost + MARGIN_SECONDS);
    minLon = Math.min(minLon, stop.lon - spread / scale);
    maxLon = Math.max(maxLon, stop.lon + spread / scale);
    minLat = Math.min(minLat, stop.lat - spread / METRES_PER_DEGREE);
    maxLat = Math.max(maxLat, stop.lat + spread / METRES_PER_DEGREE);
  });

  if (!sources.length) return null;

  const widthMetres = (maxLon - minLon) * scale;
  const heightMetres = (maxLat - minLat) * METRES_PER_DEGREE;
  const cell = Math.max(MIN_CELL_METRES, Math.max(widthMetres, heightMetres) / MAX_CELLS);
  const width = Math.max(1, Math.ceil(widthMetres / cell));
  const height = Math.max(1, Math.ceil(heightMetres / cell));
  const stride = width + 1;

  const cap = budget + MARGIN_SECONDS;
  const values = new Float64Array(stride * (height + 1)).fill(cap);

  const lonOf = (x: number) => minLon + (x * cell) / scale;
  const latOf = (y: number) => maxLat - (y * cell) / METRES_PER_DEGREE;

  // Seeding the four lattice points around a stop rather than the nearest one
  // keeps the surface honest to within a metre or two instead of half a cell.
  // A binary heap of lattice indices ordered by the value already stored for
  // them, so the walk outwards settles every point exactly once.
  // A lattice point can be improved by any of its eight neighbours before it
  // settles, so the heap keeps a few entries per point, each remembering the
  // value it was pushed with, and the settled flag discards the stale ones.
  const nodes: number[] = [];
  const keys: number[] = [];
  let heapSize = 0;

  const push = (index: number, key: number) => {
    let child = heapSize++;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (keys[parent] <= key) break;
      nodes[child] = nodes[parent];
      keys[child] = keys[parent];
      child = parent;
    }
    nodes[child] = index;
    keys[child] = key;
  };

  const pop = () => {
    const top = nodes[0];
    heapSize--;
    if (heapSize) {
      const node = nodes[heapSize];
      const key = keys[heapSize];
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        if (left >= heapSize) break;
        const right = left + 1;
        const child = right < heapSize && keys[right] < keys[left] ? right : left;
        if (keys[child] >= key) break;
        nodes[parent] = nodes[child];
        keys[parent] = keys[child];
        parent = child;
      }
      nodes[parent] = node;
      keys[parent] = key;
    }
    return top;
  };

  for (const source of sources) {
    const fx = ((source.lon - minLon) * scale) / cell;
    const fy = ((maxLat - source.lat) * METRES_PER_DEGREE) / cell;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    for (let corner = 0; corner < 4; corner++) {
      const x = x0 + (corner & 1);
      const y = y0 + (corner >> 1);
      if (x < 0 || y < 0 || x > width || y > height) continue;
      const metres = Math.hypot((x - fx) * cell, (y - fy) * cell);
      const value = source.cost + metres / WALK_SPEED;
      const index = y * stride + x;
      if (value < values[index]) {
        values[index] = value;
        push(index, value);
      }
    }
  }

  const straight = cell / WALK_SPEED;
  const diagonal = (cell * Math.SQRT2) / WALK_SPEED;
  const settled = new Uint8Array(values.length);

  while (heapSize) {
    const index = pop();
    if (settled[index]) continue;
    settled[index] = 1;
    const cost = values[index];
    if (cost >= cap) break;

    const x = index % stride;
    const y = (index - x) / stride;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx > width || ny > height) continue;
        const neighbour = ny * stride + nx;
        if (settled[neighbour]) continue;
        const step = cost + (dx && dy ? diagonal : straight);
        if (step < values[neighbour]) {
          values[neighbour] = step;
          push(neighbour, step);
        }
      }
    }
  }

  const field: Field = { values, width, height };
  const area = ringsToPolygons(contourRings(field, budget), (x, y) => [lonOf(x), latOf(y)]);

  let cells = 0;
  for (let i = 0; i < values.length; i++) if (values[i] <= budget) cells++;

  return {
    area,
    stopsReached: reach.stopsReached,
    squareKm: (cells * cell * cell) / 1e6,
    minutes: options.minutes,
    millis: performance.now() - started,
  };
}
