import type { Network, Timetable } from './feed';
import { departuresAt, serviceRunsOn } from './feed';
import type { Departure, Mode, Stop } from './types';

export interface RouteAtStop {
  routeId: string;
  shortName: string;
  longName: string;
  mode: Mode;
  colour: string;
  /** Where vehicles of this route go from here. */
  headsigns: string[];
  /** False when the route exists but is not running in the chosen window. */
  running: boolean;
}

export interface StopDetails {
  stop: Stop;
  routes: RouteAtStop[];
  departures: Departure[];
  /** True when this stop has no scheduled service at all in the whole feed. */
  neverServed: boolean;
}

export function stopDetails(
  network: Network,
  timetable: Timetable,
  stop: Stop,
  options: { hour: number; weekday: number; activeRouteIds?: Set<string> },
): StopDetails {
  const byRoute = new Map<string, RouteAtStop>();

  for (const visit of timetable.visits.get(stop.id) ?? []) {
    const { pattern, index } = visit;
    // Arriving at the last stop of a pattern is not "going" anywhere.
    if (index === pattern.stopIds.length - 1) continue;

    const route = network.routeById.get(pattern.routeId);
    if (!route) continue;

    let entry = byRoute.get(route.id);
    if (!entry) {
      entry = {
        routeId: route.id,
        shortName: route.shortName,
        longName: route.longName,
        mode: route.mode,
        colour: route.colour,
        headsigns: [],
        running: options.activeRouteIds ? options.activeRouteIds.has(route.id) : true,
      };
      byRoute.set(route.id, entry);
    }
    if (!entry.headsigns.includes(pattern.headsign)) entry.headsigns.push(pattern.headsign);
  }

  const routes = [...byRoute.values()].sort(
    (a, b) =>
      Number(b.running) - Number(a.running) ||
      a.mode.localeCompare(b.mode) ||
      a.shortName.localeCompare(b.shortName, 'en', { numeric: true }),
  );

  const departures = departuresAt(network, timetable, {
    stopId: stop.id,
    from: options.hour * 3600,
    weekday: options.weekday,
    limit: 8,
  });

  // "No departures" needs to distinguish a quiet hour from a stop the feed
  // never serves at all — the two mean very different things to a reader.
  let neverServed = true;
  for (const visit of timetable.visits.get(stop.id) ?? []) {
    const service = timetable.services.get(visit.pattern.serviceId);
    if (service && service.days.some(Boolean)) {
      neverServed = false;
      break;
    }
  }
  if (!(timetable.visits.get(stop.id) ?? []).length) neverServed = true;

  return { stop, routes, departures, neverServed };
}

export function anyServiceOnDay(timetable: Timetable, stop: Stop, weekday: number): boolean {
  for (const visit of timetable.visits.get(stop.id) ?? []) {
    const service = timetable.services.get(visit.pattern.serviceId);
    if (service && serviceRunsOn(service, weekday)) return true;
  }
  return false;
}
