/**
 * Builds the basemap and the route network into a single PMTiles archive.
 *
 * There is no tile server anywhere in this project: MapLibre reads one static
 * file over HTTP range requests. Everything in it — water, parks, the built-up
 * area, roads, transit lines and district labels — is generated from the same
 * seed as the GTFS feed, so the map and the timetable always agree.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import GeoJSONVT from 'geojson-vt';
import { fromGeojsonVt } from 'vt-pbf';
import { packArchive, zxyToTileId as zxy } from './lib/pmtiles-write.mjs';
import { buildCity, MODES } from './lib/city.mjs';
import { round6 } from './lib/geo.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const MIN_ZOOM = 6;
const MAX_ZOOM = 14;

const lonToTileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const latToTileY = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
};

const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties });
const collection = (features) => ({ type: 'FeatureCollection', features });
const ring = (coords) => coords.map(([lon, lat]) => [round6(lon), round6(lat)]);

/** Hour of the first and last departure, so the map can dim lines out of service. */
function serviceHours(route) {
  if (route.night) return [0, 5];
  if (route.mode === 'rail') return [5, 24];
  if (route.mode === 'metro') return [5, 25];
  if (route.mode === 'tram') return [5, 23];
  return [5, 23];
}

function layers(city) {
  const water = [
    feature({ type: 'Polygon', coordinates: [ring(city.river)] }, { kind: 'river' }),
    feature({ type: 'Polygon', coordinates: [ring(city.lake)] }, { kind: 'lake', name: 'Lake Kestrel' }),
  ];

  const landuse = [
    feature({ type: 'Polygon', coordinates: [ring(city.urban)] }, { kind: 'urban' }),
    ...city.parks.map((p) =>
      feature({ type: 'Polygon', coordinates: [ring(p.ring)] }, { kind: 'park', name: p.name }),
    ),
  ];

  const road = city.roads.map((r) =>
    feature({ type: 'LineString', coordinates: ring(r.line) }, { kind: r.kind }),
  );

  const route = city.routes.map((r) => {
    const [from, to] = serviceHours(r);
    return feature(
      { type: 'LineString', coordinates: ring(r.path) },
      {
        route_id: r.id,
        short_name: r.shortName,
        mode: r.mode,
        route_type: r.routeType,
        colour: `#${r.colour}`,
        night: r.night ? 1 : 0,
        from_hour: from,
        to_hour: to,
        width: MODES[r.mode].width,
      },
    );
  });

  const place = city.districts.map((d) =>
    feature(
      { type: 'Point', coordinates: [round6(d.centre[0]), round6(d.centre[1])] },
      { name: d.name, kind: 'district' },
    ),
  );

  return { water, landuse, road, route, place };
}

function build() {
  const city = buildCity();
  const grouped = layers(city);

  const indexes = Object.fromEntries(
    Object.entries(grouped).map(([name, features]) => [
      name,
      new GeoJSONVT(collection(features), {
        maxZoom: MAX_ZOOM,
        indexMaxZoom: MAX_ZOOM,
        indexMaxPoints: 0,
        tolerance: 3,
        extent: 4096,
        buffer: 64,
      }),
    ]),
  );

  const tiles = new Map();
  let emptyTiles = 0;

  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const x0 = Math.floor(lonToTileX(city.bbox[0], z));
    const x1 = Math.floor(lonToTileX(city.bbox[2], z));
    const y0 = Math.floor(latToTileY(city.bbox[3], z));
    const y1 = Math.floor(latToTileY(city.bbox[1], z));

    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const present = {};
        for (const [name, index] of Object.entries(indexes)) {
          const tile = index.getTile(z, x, y);
          if (tile && tile.features.length) present[name] = tile;
        }
        if (!Object.keys(present).length) {
          emptyTiles++;
          continue;
        }
        const body = fromGeojsonVt(present, { version: 2, extent: 4096 });
        tiles.set(
          zxy(z, x, y),
          gzipSync(Buffer.from(body.buffer, body.byteOffset, body.byteLength), { level: 9 }),
        );
      }
    }
  }

  const metadata = {
    name: `${city.name} transit`,
    description: 'Basemap and transit network for a generated city',
    type: 'overlay',
    version: '1',
    attribution: 'Generated dataset',
    vector_layers: [
      { id: 'water', minzoom: MIN_ZOOM, maxzoom: MAX_ZOOM, fields: { kind: 'String', name: 'String' } },
      { id: 'landuse', minzoom: MIN_ZOOM, maxzoom: MAX_ZOOM, fields: { kind: 'String', name: 'String' } },
      { id: 'road', minzoom: MIN_ZOOM, maxzoom: MAX_ZOOM, fields: { kind: 'String' } },
      {
        id: 'route',
        minzoom: MIN_ZOOM,
        maxzoom: MAX_ZOOM,
        fields: {
          route_id: 'String', short_name: 'String', mode: 'String', route_type: 'Number',
          colour: 'String', night: 'Number', from_hour: 'Number', to_hour: 'Number', width: 'Number',
        },
      },
      { id: 'place', minzoom: MIN_ZOOM, maxzoom: MAX_ZOOM, fields: { name: 'String', kind: 'String' } },
    ],
  };

  const centre = [(city.bbox[0] + city.bbox[2]) / 2, (city.bbox[1] + city.bbox[3]) / 2];
  const { buffer, stats } = packArchive({
    tiles,
    metadata,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    bbox: city.bbox,
    centre,
    centreZoom: 12,
  });

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'ostgrad.pmtiles'), buffer);

  console.log(
    `ostgrad.pmtiles: ${(buffer.length / 1024).toFixed(0)} KB, ` +
      `${stats.addressed} tiles (${stats.unique} unique bodies), ` +
      `root directory ${stats.rootBytes} B, ${emptyTiles} empty tiles skipped`,
  );
}

build();
