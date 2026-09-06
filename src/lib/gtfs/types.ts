export type Mode = 'tram' | 'metro' | 'rail' | 'bus';

/** GTFS `route_type` values this feed uses. */
export const MODE_BY_ROUTE_TYPE: Record<number, Mode> = {
  0: 'tram',
  1: 'metro',
  2: 'rail',
  3: 'bus',
};

export const MODES: Mode[] = ['metro', 'tram', 'rail', 'bus'];

export const MODE_LABEL: Record<Mode, string> = {
  metro: 'Metro',
  tram: 'Tram',
  rail: 'Suburban rail',
  bus: 'Bus',
};

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  district: string;
  /** Filled in once the timetable is loaded. */
  routeIds: string[];
  modes: Mode[];
}

export interface Route {
  id: string;
  shortName: string;
  longName: string;
  routeType: number;
  mode: Mode;
  colour: string;
}

export type ServiceId = string;

/** Which calendar entry applies to a given weekday. */
export interface Service {
  id: ServiceId;
  days: boolean[];
}

/**
 * One direction of one route on one service. High-frequency modes describe
 * themselves with `frequencies.txt` bands; suburban rail lists every run.
 */
export interface Pattern {
  tripId: string;
  routeId: string;
  serviceId: ServiceId;
  headsign: string;
  directionId: number;
  stopIds: string[];
  /** Seconds from the first stop of the pattern. */
  offsets: number[];
  bands: FrequencyBand[];
  /** Absolute departure times from the first stop, for non-frequency trips. */
  fixedDepartures: number[];
}

export interface FrequencyBand {
  start: number;
  end: number;
  headway: number;
}

export interface Departure {
  time: number;
  routeId: string;
  shortName: string;
  mode: Mode;
  colour: string;
  headsign: string;
  tripId: string;
  /** True when the time comes from a headway band rather than a printed time. */
  approximate: boolean;
}
