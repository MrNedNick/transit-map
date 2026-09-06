import type { Network, Timetable } from '../gtfs/feed';
import { serviceRunsOn } from '../gtfs/feed';
import type { Mode, Pattern } from '../gtfs/types';
import { buildTransfers, type Transfer } from './walk';

const DAY_SECONDS = 86_400;

/** Nobody plans a fifteen-minute trip around a twenty-minute wait. */
export const MAX_WAIT = 20 * 60;

/** Rounds of the search, so three changes of vehicle. */
const ROUNDS = 4;

/**
 * How long someone arriving at a stop at `from` waits for this pattern, or
 * `null` when it is not worth waiting for. A headway band is answered with
 * half its headway — the average wait for a passenger who does not read the
 * timetable — while a printed departure is answered with the real gap.
 */
export function patternWait(pattern: Pattern, from: number): number | null {
  let best: number | null = null;
  const consider = (seconds: number) => {
    if (seconds < 0 || seconds > MAX_WAIT) return;
    if (best === null || seconds < best) best = seconds;
  };

  for (const band of pattern.bands) {
    // Night service is written as 24:00-29:00, so the same band is tried
    // where it is printed and one service day earlier.
    for (const shift of [0, -DAY_SECONDS]) {
      const start = band.start + shift;
      const end = band.end + shift;
      if (from >= start && from < end) consider(band.headway / 2);
      else if (from < start) consider(start - from);
    }
  }
  for (const departure of pattern.fixedDepartures) {
    for (const shift of [0, -DAY_SECONDS]) consider(departure + shift - from);
  }

  return best;
}

/** One pattern reduced to what the search actually reads. */
interface Ride {
  stops: Int32Array;
  offsets: Int32Array;
  wait: number;
}

interface StaticGraph {
  indexOf: Map<string, number>;
  transfers: Transfer[][];
  /** Patterns as typed arrays, built once instead of on every search. */
  rides: Map<Pattern, { stops: Int32Array; offsets: Int32Array }>;
}

const staticGraphs = new WeakMap<Network, StaticGraph>();

function staticGraph(network: Network, timetable: Timetable): StaticGraph {
  const cached = staticGraphs.get(network);
  if (cached) return cached;

  const indexOf = new Map(network.stops.map((stop, index) => [stop.id, index]));
  const rides = new Map<Pattern, { stops: Int32Array; offsets: Int32Array }>();
  for (const pattern of timetable.patterns) {
    const indices = new Int32Array(pattern.stopIds.length);
    for (let i = 0; i < pattern.stopIds.length; i++) {
      indices[i] = indexOf.get(pattern.stopIds[i]) ?? -1;
    }
    rides.set(pattern, { stops: indices, offsets: Int32Array.from(pattern.offsets) });
  }

  const graph: StaticGraph = {
    indexOf,
    transfers: buildTransfers(network.stops),
    rides,
  };
  staticGraphs.set(network, graph);
  return graph;
}

export interface ReachOptions {
  hour: number;
  weekday: number;
  modes: Mode[];
  /** Seconds of travel to spend. */
  budget: number;
}

export interface Reach {
  /** Seconds to each stop the search could get to, by stop index. */
  costs: Float64Array;
  stopsReached: number;
  /** Milliseconds the search itself took. */
  millis: number;
}

/**
 * How long it takes to get from one stop to every other one, riding and
 * walking. This is a frequency-based RAPTOR: each round scans every usable
 * pattern once, boarding with the arrival times the previous round settled on,
 * then lets people walk between nearby stops.
 */
export function reachFrom(
  network: Network,
  timetable: Timetable,
  originStopId: string,
  options: ReachOptions,
): Reach | null {
  const started = performance.now();
  const { indexOf, transfers, rides: prepared } = staticGraph(network, timetable);

  const origin = indexOf.get(originStopId);
  if (origin === undefined) return null;

  const from = options.hour * 3600;
  const allowed = new Set(options.modes);
  const budget = options.budget;

  const rides: Ride[] = [];
  for (const pattern of timetable.patterns) {
    const service = timetable.services.get(pattern.serviceId);
    if (!service || !serviceRunsOn(service, options.weekday)) continue;
    const route = network.routeById.get(pattern.routeId);
    if (!route || !allowed.has(route.mode)) continue;
    const wait = patternWait(pattern, from);
    if (wait === null || wait > budget) continue;

    const arrays = prepared.get(pattern);
    if (arrays) rides.push({ stops: arrays.stops, offsets: arrays.offsets, wait });
  }

  const size = network.stops.length;
  const costs = new Float64Array(size).fill(Infinity);
  const previous = new Float64Array(size).fill(Infinity);
  costs[origin] = 0;

  // The first thing anyone does is walk away from where they are standing.
  for (const transfer of transfers[origin]) {
    if (transfer.seconds < costs[transfer.to]) costs[transfer.to] = transfer.seconds;
  }

  for (let round = 0; round < ROUNDS; round++) {
    previous.set(costs);
    let improved = false;

    for (const ride of rides) {
      // The cost of being aboard this pattern, expressed at its first stop, so
      // that arriving anywhere down the line is one addition.
      let aboard = Infinity;
      for (let i = 0; i < ride.stops.length; i++) {
        const stop = ride.stops[i];
        if (stop < 0) continue;

        if (aboard < Infinity) {
          const arrival = aboard + ride.offsets[i];
          if (arrival <= budget && arrival < costs[stop]) {
            costs[stop] = arrival;
            improved = true;
          }
        }

        const standing = previous[stop];
        if (standing < Infinity) {
          const boarding = standing + ride.wait - ride.offsets[i];
          if (boarding < aboard) aboard = boarding;
        }
      }
    }

    if (!improved) break;

    // Riding somewhere new opens up everything within walking distance of it.
    for (let stop = 0; stop < size; stop++) {
      const cost = costs[stop];
      if (cost === Infinity || cost >= budget) continue;
      for (const transfer of transfers[stop]) {
        const walked = cost + transfer.seconds;
        if (walked <= budget && walked < costs[transfer.to]) costs[transfer.to] = walked;
      }
    }
  }

  let stopsReached = 0;
  for (let stop = 0; stop < size; stop++) if (costs[stop] <= budget) stopsReached++;

  return { costs, stopsReached, millis: performance.now() - started };
}
