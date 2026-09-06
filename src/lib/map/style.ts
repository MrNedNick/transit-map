import type { StyleSpecification } from 'maplibre-gl';
import type { Mode } from '../gtfs/types';
import { GLYPHS_URL } from './glyphs';

export interface Palette {
  background: string;
  urban: string;
  park: string;
  water: string;
  street: string;
  arterial: string;
  label: string;
  labelHalo: string;
  districtLabel: string;
  clusterFill: string;
  clusterStroke: string;
  clusterText: string;
  stopStroke: string;
  selected: string;
  isochrone: string;
  isochroneLine: string;
  routeDim: number;
}

export const PALETTES: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#eaeeec',
    urban: '#e2e7e4',
    park: '#d7e8cf',
    water: '#b9d5e8',
    street: '#f6f8f7',
    arterial: '#ffffff',
    label: '#33474a',
    labelHalo: '#ffffff',
    districtLabel: '#6b7f80',
    clusterFill: '#0f766e',
    clusterStroke: '#ffffff',
    clusterText: '#ffffff',
    stopStroke: '#ffffff',
    selected: '#111827',
    isochrone: '#0f766e',
    isochroneLine: '#0b544e',
    routeDim: 0.85,
  },
  dark: {
    background: '#0b1211',
    urban: '#121b1a',
    park: '#152420',
    water: '#0e2130',
    street: '#1b2625',
    arterial: '#243130',
    label: '#cddad8',
    labelHalo: '#0b1211',
    districtLabel: '#8b9d9b',
    clusterFill: '#2dd4bf',
    clusterStroke: '#0b1211',
    clusterText: '#06201d',
    stopStroke: '#0b1211',
    selected: '#f8fafc',
    isochrone: '#2dd4bf',
    isochroneLine: '#5eead4',
    routeDim: 1,
  },
};

/** Circle colour for a stop, driven by the most important mode calling there. */
export const MODE_COLOUR: Record<'light' | 'dark', Record<Mode, string>> = {
  light: { metro: '#1d4ed8', rail: '#7c3aed', tram: '#b45309', bus: '#0f766e' },
  dark: { metro: '#7ba7ff', rail: '#c4a5ff', tram: '#f0a742', bus: '#5eead4' },
};

export interface StyleOptions {
  theme: 'light' | 'dark';
  pmtilesUrl: string;
  modes: Mode[];
  /** `null` while the timetable is still loading — show everything. */
  activeRouteIds: string[] | null;
}

function modeColourExpression(theme: 'light' | 'dark') {
  const colours = MODE_COLOUR[theme];
  return [
    'match',
    ['get', 'topMode'],
    'metro', colours.metro,
    'rail', colours.rail,
    'tram', colours.tram,
    colours.bus,
  ];
}

export function buildStyle({ theme, pmtilesUrl, modes, activeRouteIds }: StyleOptions): StyleSpecification {
  const palette = PALETTES[theme];

  const routeFilter: unknown[] = ['all', ['in', ['get', 'mode'], ['literal', modes]]];
  if (activeRouteIds) {
    routeFilter.push(['in', ['get', 'route_id'], ['literal', activeRouteIds]]);
  }

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      city: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: 'Generated dataset — Ostgrad',
      },
      stops: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 56,
        clusterMaxZoom: 14,
      },
      isochrone: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': palette.background } },
      {
        id: 'urban',
        type: 'fill',
        source: 'city',
        'source-layer': 'landuse',
        filter: ['==', ['get', 'kind'], 'urban'],
        paint: { 'fill-color': palette.urban },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'city',
        'source-layer': 'landuse',
        filter: ['==', ['get', 'kind'], 'park'],
        paint: { 'fill-color': palette.park },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'city',
        'source-layer': 'water',
        paint: { 'fill-color': palette.water },
      },
      {
        id: 'road-street',
        type: 'line',
        source: 'city',
        'source-layer': 'road',
        filter: ['==', ['get', 'kind'], 'street'],
        minzoom: 11,
        paint: {
          'line-color': palette.street,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 5],
        },
      },
      {
        id: 'road-arterial',
        type: 'line',
        source: 'city',
        'source-layer': 'road',
        filter: ['in', ['get', 'kind'], ['literal', ['arterial', 'ring']]],
        paint: {
          'line-color': palette.arterial,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 16, 9],
        },
      },
      {
        id: 'isochrone-fill',
        type: 'fill',
        source: 'isochrone',
        paint: { 'fill-color': palette.isochrone, 'fill-opacity': 0.18 },
      },
      {
        id: 'isochrone-outline',
        type: 'line',
        source: 'isochrone',
        paint: {
          'line-color': palette.isochroneLine,
          'line-width': 1.6,
          'line-opacity': 0.9,
        },
      },
      {
        id: 'route-line',
        type: 'line',
        source: 'city',
        'source-layer': 'route',
        filter: routeFilter,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'colour'],
          // Two hundred bus lines at city zoom is noise, not information, so
          // the network reveals itself by importance as you zoom in.
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9, ['match', ['get', 'mode'], 'metro', 0.9, 'rail', 0.8, 0],
            11, ['match', ['get', 'mode'], 'metro', 0.95, 'rail', 0.85, 'tram', 0.7, 0.05],
            12.5, ['match', ['get', 'mode'], 'bus', 0.42, 0.9],
            14, ['match', ['get', 'mode'], 'bus', 0.62, 0.95],
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9, ['*', ['get', 'width'], 0.35],
            13, ['*', ['get', 'width'], 1],
            16, ['*', ['get', 'width'], 2.2],
          ],
        },
      },
      {
        id: 'district-label',
        type: 'symbol',
        source: 'city',
        'source-layer': 'place',
        minzoom: 10,
        maxzoom: 14,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 13, 13],
          'text-letter-spacing': 0.12,
          'text-transform': 'uppercase',
          'text-padding': 14,
        },
        paint: {
          'text-color': palette.districtLabel,
          'text-halo-color': palette.labelHalo,
          'text-halo-width': 1.4,
        },
      },
      {
        id: 'route-label-major',
        type: 'symbol',
        source: 'city',
        'source-layer': 'route',
        filter: ['all', ...routeFilter.slice(1), ['!=', ['get', 'mode'], 'bus']] as never,
        minzoom: 11.5,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'short_name'],
          'text-font': ['Bold'],
          'text-size': 11,
          'symbol-spacing': 260,
          'text-rotation-alignment': 'map',
          'text-pitch-alignment': 'viewport',
        },
        paint: {
          'text-color': ['get', 'colour'],
          'text-halo-color': palette.labelHalo,
          'text-halo-width': 1.6,
        },
      },
      {
        id: 'route-label-bus',
        type: 'symbol',
        source: 'city',
        'source-layer': 'route',
        filter: ['all', ...routeFilter.slice(1), ['==', ['get', 'mode'], 'bus']] as never,
        minzoom: 13.5,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'short_name'],
          'text-font': ['Regular'],
          'text-size': 10,
          'symbol-spacing': 300,
          'text-rotation-alignment': 'map',
          'text-pitch-alignment': 'viewport',
        },
        paint: {
          'text-color': ['get', 'colour'],
          'text-halo-color': palette.labelHalo,
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'stop-point',
        type: 'circle',
        source: 'stops',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': modeColourExpression(theme),
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.2, 13, 3.6, 16, 7],
          'circle-stroke-color': palette.stopStroke,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 1.6],
        },
      },
      {
        id: 'stop-selected',
        type: 'circle',
        source: 'stops',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-color': palette.selected,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 11],
          'circle-stroke-color': palette.stopStroke,
          'circle-stroke-width': 2.5,
        },
      },
      {
        id: 'cluster',
        type: 'circle',
        source: 'stops',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': palette.clusterFill,
          'circle-opacity': 0.92,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'point_count'],
            2, 11,
            25, 17,
            120, 24,
            600, 32,
          ],
          'circle-stroke-color': palette.clusterStroke,
          'circle-stroke-width': 1.5,
        },
      },
      {
        id: 'cluster-count',
        type: 'symbol',
        source: 'stops',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Bold'],
          'text-size': ['interpolate', ['linear'], ['get', 'point_count'], 2, 11, 200, 14],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': palette.clusterText },
      },
    ],
  } as StyleSpecification;
}
