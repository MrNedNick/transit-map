import {
  MODE_BY_ROUTE_TYPE,
  type Departure,
  type FrequencyBand,
  type Mode,
  type Pattern,
  type Route,
  type Service,
  type Stop,
} from './types';
import { columns, parseCsv, parseGtfsTime } from './csv';

const base = import.meta.env.BASE_URL;
export const feedUrl = (file: string) => `${base}data/gtfs/${file}`;

async function fetchText(file: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(feedUrl(file), { signal });
  if (!response.ok) {
    throw new Error(`${file} could not be loaded (HTTP ${response.status})`);
  }
  return response.text();
}

/** Stops and routes — everything the map needs for its first paint. */
export interface Network {
  stops: Stop[];
  stopById: Map<string, Stop>;
  routes: Route[];
  routeById: Map<string, Route>;
}

export async function loadNetwork(signal?: AbortSignal): Promise<Network> {
  const [stopsText, routesText] = await Promise.all([
    fetchText('stops.txt', signal),
    fetchText('routes.txt', signal),
  ]);

  const stopsCsv = parseCsv(stopsText);
  const [sId, sName, sLat, sLon, sZone] = columns(
    stopsCsv.header,
    ['stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'zone_id'],
    'stops.txt',
  );
  const stops: Stop[] = stopsCsv.rows.map((row) => ({
    id: row[sId],
    name: row[sName],
    lat: Number(row[sLat]),
    lon: Number(row[sLon]),
    district: row[sZone],
    routeIds: [],
    modes: [],
  }));

  const routesCsv = parseCsv(routesText);
  const [rId, rShort, rLong, rType, rColour] = columns(
    routesCsv.header,
    ['route_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color'],
    'routes.txt',
  );
  const routes: Route[] = routesCsv.rows.map((row) => {
    const routeType = Number(row[rType]);
    return {
      id: row[rId],
      shortName: row[rShort],
      longName: row[rLong],
      routeType,
      mode: MODE_BY_ROUTE_TYPE[routeType] ?? 'bus',
      colour: `#${row[rColour]}`,
    };
  });

  return {
    stops,
    stopById: new Map(stops.map((s) => [s.id, s])),
    routes,
    routeById: new Map(routes.map((r) => [r.id, r])),
  };
}

/** A stop's place in one pattern: which pattern, and how far into it. */
export interface Visit {
  pattern: Pattern;
  index: number;
}

export interface Timetable {
  patterns: Pattern[];
  services: Map<string, Service>;
  /** stop id -> every pattern that calls there. */
  visits: Map<string, Visit[]>;
  stopTimeCount: number;
}

export async function loadTimetable(network: Network, signal?: AbortSignal): Promise<Timetable> {
  const [calendarText, tripsText, stopTimesText, frequenciesText] = await Promise.all([
    fetchText('calendar.txt', signal),
    fetchText('trips.txt', signal),
    fetchText('stop_times.txt', signal),
    fetchText('frequencies.txt', signal),
  ]);

  const services = new Map<string, Service>();
  const calendarCsv = parseCsv(calendarText);
  const dayColumns = columns(
    calendarCsv.header,
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    'calendar.txt',
  );
  const [cId] = columns(calendarCsv.header, ['service_id'], 'calendar.txt');
  for (const row of calendarCsv.rows) {
    services.set(row[cId], {
      id: row[cId],
      days: dayColumns.map((index) => row[index] === '1'),
    });
  }

  const patterns: Pattern[] = [];
  const patternByTrip = new Map<string, Pattern>();
  const tripsCsv = parseCsv(tripsText);
  const [tRoute, tService, tTrip, tHeadsign, tDirection] = columns(
    tripsCsv.header,
    ['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id'],
    'trips.txt',
  );
  for (const row of tripsCsv.rows) {
    const pattern: Pattern = {
      tripId: row[tTrip],
      routeId: row[tRoute],
      serviceId: row[tService],
      headsign: row[tHeadsign],
      directionId: Number(row[tDirection]),
      stopIds: [],
      offsets: [],
      bands: [],
      fixedDepartures: [],
    };
    patterns.push(pattern);
    patternByTrip.set(pattern.tripId, pattern);
  }

  const stopTimesCsv = parseCsv(stopTimesText);
  const [stTrip, stDeparture, stStop] = columns(
    stopTimesCsv.header,
    ['trip_id', 'departure_time', 'stop_id'],
    'stop_times.txt',
  );
  const absoluteFirst = new Map<string, number>();
  for (const row of stopTimesCsv.rows) {
    const pattern = patternByTrip.get(row[stTrip]);
    if (!pattern) continue;
    const time = parseGtfsTime(row[stDeparture]);
    if (!pattern.stopIds.length) absoluteFirst.set(pattern.tripId, time);
    pattern.stopIds.push(row[stStop]);
    pattern.offsets.push(time - (absoluteFirst.get(pattern.tripId) as number));
  }

  const frequenciesCsv = parseCsv(frequenciesText);
  const [fTrip, fStart, fEnd, fHeadway] = columns(
    frequenciesCsv.header,
    ['trip_id', 'start_time', 'end_time', 'headway_secs'],
    'frequencies.txt',
  );
  for (const row of frequenciesCsv.rows) {
    const pattern = patternByTrip.get(row[fTrip]);
    if (!pattern) continue;
    pattern.bands.push({
      start: parseGtfsTime(row[fStart]),
      end: parseGtfsTime(row[fEnd]),
      headway: Number(row[fHeadway]),
    });
  }

  /**
   * A trip with no frequency band runs exactly once, at the time printed in
   * `stop_times.txt`. Suburban rail in this feed is written that way.
   */
  for (const pattern of patterns) {
    if (!pattern.bands.length) {
      const first = absoluteFirst.get(pattern.tripId);
      if (first !== undefined) pattern.fixedDepartures.push(first);
    }
  }

  const visits = new Map<string, Visit[]>();
  for (const pattern of patterns) {
    pattern.stopIds.forEach((stopId, index) => {
      let list = visits.get(stopId);
      if (!list) visits.set(stopId, (list = []));
      list.push({ pattern, index });
    });
  }

  // Now that the timetable is in, every stop knows what actually calls there.
  for (const stop of network.stops) {
    const routeIds = new Set<string>();
    const modes = new Set<Mode>();
    for (const visit of visits.get(stop.id) ?? []) {
      routeIds.add(visit.pattern.routeId);
      const route = network.routeById.get(visit.pattern.routeId);
      if (route) modes.add(route.mode);
    }
    stop.routeIds = [...routeIds];
    stop.modes = [...modes];
  }

  return { patterns, services, visits, stopTimeCount: stopTimesCsv.rows.length };
}

export function serviceRunsOn(service: Service, weekday: number): boolean {
  // GTFS calendar columns start on Monday; `Date#getDay` starts on Sunday.
  return service.days[(weekday + 6) % 7] ?? false;
}

/** The first departure of a headway band at or after `from`, if there is one. */
export function nextInBand(band: FrequencyBand, offset: number, from: number): number | null {
  const first = band.start + offset;
  if (from <= first) return first;
  const steps = Math.ceil((from - first) / band.headway);
  const time = first + steps * band.headway;
  return time <= band.end + offset ? time : null;
}

export interface DepartureQuery {
  stopId: string;
  from: number;
  weekday: number;
  limit?: number;
  modes?: Set<Mode>;
}

export function departuresAt(
  network: Network,
  timetable: Timetable,
  query: DepartureQuery,
): Departure[] {
  const { stopId, from, weekday, limit = 8 } = query;
  const found: Departure[] = [];

  for (const visit of timetable.visits.get(stopId) ?? []) {
    const { pattern, index } = visit;
    // The last stop of a pattern is an arrival, never a departure.
    if (index === pattern.stopIds.length - 1) continue;

    const service = timetable.services.get(pattern.serviceId);
    if (!service || !serviceRunsOn(service, weekday)) continue;

    const route = network.routeById.get(pattern.routeId);
    if (!route) continue;
    if (query.modes && !query.modes.has(route.mode)) continue;

    const offset = pattern.offsets[index];
    const times: Array<{ time: number; approximate: boolean }> = [];

    for (const band of pattern.bands) {
      let time = nextInBand(band, offset, from);
      for (let n = 0; n < limit && time !== null; n++) {
        times.push({ time, approximate: true });
        time = nextInBand(band, offset, time + 1);
      }
    }
    for (const departure of pattern.fixedDepartures) {
      const time = departure + offset;
      if (time >= from) times.push({ time, approximate: false });
    }

    for (const { time, approximate } of times) {
      found.push({
        time,
        routeId: route.id,
        shortName: route.shortName,
        mode: route.mode,
        colour: route.colour,
        headsign: pattern.headsign,
        tripId: pattern.tripId,
        approximate,
      });
    }
  }

  found.sort((a, b) => a.time - b.time || a.shortName.localeCompare(b.shortName));

  // One line per route and headsign — a stop card should not be eight copies
  // of the same bus because the band produced eight departures.
  const seen = new Set<string>();
  const unique: Departure[] = [];
  for (const departure of found) {
    const key = `${departure.routeId}:${departure.headsign}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(departure);
    if (unique.length >= limit) break;
  }
  return unique;
}
