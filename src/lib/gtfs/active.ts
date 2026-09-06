import type { Network, Timetable } from './feed';
import { serviceRunsOn } from './feed';
import type { Mode, Pattern } from './types';

const DAY_SECONDS = 86400;

/** Does this pattern put a vehicle on the road during the given hour? */
function runsDuring(pattern: Pattern, from: number, to: number): boolean {
  const ride = pattern.offsets[pattern.offsets.length - 1] ?? 0;

  const overlaps = (start: number, end: number) =>
    // Service written as 25:30 belongs to the small hours of the same day.
    (start < to && end > from) ||
    (start - DAY_SECONDS < to && end - DAY_SECONDS > from);

  for (const band of pattern.bands) {
    if (overlaps(band.start, band.end + ride)) return true;
  }
  for (const departure of pattern.fixedDepartures) {
    if (overlaps(departure, departure + ride)) return true;
  }
  return false;
}

export interface ActiveSlice {
  routeIds: string[];
  stopIds: Set<string>;
}

/**
 * Which routes and stops are in service at a given hour on a given kind of
 * day. This is what makes the time filter mean something: at three in the
 * morning the map is left with the ten night routes and the stops they call at.
 */
export function activeAt(
  network: Network,
  timetable: Timetable,
  options: { hour: number; weekday: number; modes: Mode[] },
): ActiveSlice {
  const from = options.hour * 3600;
  const to = from + 3600;
  const allowed = new Set(options.modes);

  const routeIds = new Set<string>();
  const stopIds = new Set<string>();

  for (const pattern of timetable.patterns) {
    const service = timetable.services.get(pattern.serviceId);
    if (!service || !serviceRunsOn(service, options.weekday)) continue;

    const route = network.routeById.get(pattern.routeId);
    if (!route || !allowed.has(route.mode)) continue;
    if (!runsDuring(pattern, from, to)) continue;

    routeIds.add(route.id);
    for (const stopId of pattern.stopIds) stopIds.add(stopId);
  }

  return { routeIds: [...routeIds], stopIds };
}
