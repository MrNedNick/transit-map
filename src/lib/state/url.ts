import { MODES, type Mode } from '../gtfs/types';

export type DayType = 'wd' | 'sa' | 'su';

export interface AppState {
  lon: number;
  lat: number;
  zoom: number;
  modes: Mode[];
  hour: number;
  day: DayType;
  stopId: string | null;
  minutes: number;
}

export const DEFAULT_STATE: AppState = {
  lon: 12.5,
  lat: 49.0,
  zoom: 11.4,
  modes: [...MODES],
  hour: 8,
  day: 'wd',
  stopId: null,
  minutes: 15,
};

export const DAY_LABEL: Record<DayType, string> = {
  wd: 'Weekday',
  sa: 'Saturday',
  su: 'Sunday',
};

/** GTFS calendar columns start on Monday; `Date#getDay` starts on Sunday. */
export const WEEKDAY_INDEX: Record<DayType, number> = { wd: 2, sa: 6, su: 0 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function parseNumber(value: string | null | undefined, fallback: number, min: number, max: number): number {
  // `Number('')` is 0, which would silently drop the map into the Atlantic.
  if (value === null || value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

export function decodeState(search: string): AppState {
  const params = new URLSearchParams(search);
  const centre = (params.get('c') ?? '').split(',');

  const modesParam = params.get('m');
  const requested = modesParam ? modesParam.split(',') : null;
  const modes = requested
    ? MODES.filter((mode) => requested.includes(mode))
    : [...MODES];

  const day = params.get('d');

  return {
    lon: parseNumber(centre[0], DEFAULT_STATE.lon, -180, 180),
    lat: parseNumber(centre[1], DEFAULT_STATE.lat, -85, 85),
    zoom: parseNumber(params.get('z'), DEFAULT_STATE.zoom, 9, 17),
    // An empty mode list would render an empty map, which reads as a bug.
    modes: modes.length ? modes : [...MODES],
    hour: Math.round(parseNumber(params.get('h'), DEFAULT_STATE.hour, 0, 23)),
    day: day === 'sa' || day === 'su' ? day : 'wd',
    stopId: params.get('s'),
    minutes: Math.round(parseNumber(params.get('i'), DEFAULT_STATE.minutes, 5, 45)),
  };
}

/** Only what differs from the default ends up in the link. */
export function encodeState(state: AppState): string {
  const params = new URLSearchParams();
  params.set('c', `${state.lon.toFixed(4)},${state.lat.toFixed(4)}`);
  params.set('z', state.zoom.toFixed(2));
  if (state.modes.length !== MODES.length) {
    // Canonical order, so the same selection always produces the same link.
    params.set('m', MODES.filter((mode) => state.modes.includes(mode)).join(','));
  }
  if (state.hour !== DEFAULT_STATE.hour) params.set('h', String(state.hour));
  if (state.day !== DEFAULT_STATE.day) params.set('d', state.day);
  if (state.stopId) params.set('s', state.stopId);
  if (state.minutes !== DEFAULT_STATE.minutes) params.set('i', String(state.minutes));
  return `?${params.toString()}`;
}

/** True when two states differ in anything other than the camera. */
export function differsBeyondCamera(a: AppState, b: AppState): boolean {
  return (
    a.stopId !== b.stopId ||
    a.hour !== b.hour ||
    a.day !== b.day ||
    a.minutes !== b.minutes ||
    a.modes.join(',') !== b.modes.join(',')
  );
}
