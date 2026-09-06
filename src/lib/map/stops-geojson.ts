import type { Mode, Stop } from '../gtfs/types';

/** Metro beats rail beats tram beats bus when a stop is served by several. */
const PRIORITY: Mode[] = ['metro', 'rail', 'tram', 'bus'];

export function topMode(modes: Mode[]): Mode {
  for (const mode of PRIORITY) if (modes.includes(mode)) return mode;
  return 'bus';
}

export interface StopFeatureProperties {
  id: string;
  name: string;
  district: string;
  topMode: Mode;
  modes: string;
}

export function stopsToGeoJson(stops: Stop[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: stops.map((stop) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
      properties: {
        id: stop.id,
        name: stop.name,
        district: stop.district,
        topMode: topMode(stop.modes),
        modes: stop.modes.join(','),
      } satisfies StopFeatureProperties,
    })),
  };
}
