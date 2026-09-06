/**
 * Generates the GTFS feed the app reads at runtime.
 *
 * The city of Ostgrad is invented, but the feed is not a mock: it is a valid
 * GTFS Schedule dataset (stops, routes, trips, stop_times, frequencies,
 * calendar) and the app parses it the same way it would parse a real one.
 * Everything is derived from one seed, so the output is byte-for-byte stable.
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCity, MODES } from './lib/city.mjs';
import { makeRng } from './lib/rng.mjs';
import { distance, round6 } from './lib/geo.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'gtfs');

const DWELL_SECONDS = 20;

/** Frequency bands per mode and service, in seconds between departures. */
const BANDS = {
  metro: {
    WD: [['05:00', '06:30', 600], ['06:30', '09:00', 240], ['09:00', '16:00', 360], ['16:00', '19:00', 240], ['19:00', '22:00', 480], ['22:00', '24:30', 900]],
    SA: [['06:00', '09:00', 720], ['09:00', '20:00', 480], ['20:00', '25:00', 900]],
    SU: [['06:30', '09:00', 900], ['09:00', '20:00', 600], ['20:00', '24:00', 900]],
  },
  tram: {
    WD: [['05:15', '07:00', 900], ['07:00', '09:00', 360], ['09:00', '16:00', 600], ['16:00', '19:00', 360], ['19:00', '23:00', 900]],
    SA: [['06:00', '23:00', 720]],
    SU: [['07:00', '22:30', 900]],
  },
  bus: {
    WD: [['05:30', '07:00', 1200], ['07:00', '09:00', 600], ['09:00', '16:00', 900], ['16:00', '19:00', 600], ['19:00', '23:00', 1500]],
    WE: [['06:30', '22:30', 1800]],
  },
  nightbus: {
    WD: [['24:00', '28:30', 1800]],
    WE: [['24:00', '29:00', 1800]],
  },
};

/** Suburban rail is written out as explicit trips, the way real feeds do it. */
const RAIL_TIMETABLE = {
  WD: { from: '05:10', to: '23:40', peak: 900, base: 1800 },
  WE: { from: '06:10', to: '23:10', peak: 1800, base: 1800 },
};

const toSeconds = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 3600 + m * 60;
};

const toClock = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function csv(header, rows) {
  const lines = [header.join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\n') + '\n';
}

/** Seconds from the first stop to each stop of the pattern. */
function runningOffsets(stops, speedKmh) {
  const metresPerSecond = (speedKmh * 1000) / 3600;
  const offsets = [0];
  for (let i = 1; i < stops.length; i++) {
    const metres = distance([stops[i - 1].lon, stops[i - 1].lat], [stops[i].lon, stops[i].lat]);
    const previous = offsets[i - 1];
    offsets.push(previous + Math.max(30, Math.round(metres / metresPerSecond)) + DWELL_SECONDS);
  }
  return offsets;
}

function build() {
  const city = buildCity();
  const rng = makeRng(city.seed + 7);

  const routes = [];
  const trips = [];
  const stopTimes = [];
  const frequencies = [];

  const TEMPLATE_START = toSeconds('06:00');

  for (const route of city.routes) {
    const cfg = MODES[route.mode];
    const bandKey = route.night ? 'nightbus' : route.mode;
    const weekdayOnly = route.mode === 'bus' && !route.night && rng() < 0.18;

    routes.push([
      route.id,
      'OST',
      route.shortName,
      route.longName,
      cfg.routeType,
      route.colour,
      'FFFFFF',
    ]);

    const services =
      route.mode === 'rail'
        ? ['WD', 'WE']
        : bandKey === 'bus' || bandKey === 'nightbus'
          ? weekdayOnly
            ? ['WD']
            : ['WD', 'WE']
          : ['WD', 'SA', 'SU'];

    for (const service of services) {
      for (const direction of [0, 1]) {
        const ordered = direction === 0 ? route.stops : [...route.stops].reverse();
        const offsets = runningOffsets(ordered, cfg.speedKmh);
        const headsign = ordered[ordered.length - 1].name;

        if (route.mode === 'rail') {
          const plan = RAIL_TIMETABLE[service];
          const from = toSeconds(plan.from);
          const to = toSeconds(plan.to);
          let departure = from + direction * 240;
          let n = 0;
          while (departure <= to) {
            const tripId = `${route.id}-${direction}-${service}-${String(++n).padStart(3, '0')}`;
            trips.push([route.id, service, tripId, headsign, direction]);
            ordered.forEach((stop, i) => {
              const t = toClock(departure + offsets[i]);
              stopTimes.push([tripId, t, t, stop.id, i + 1]);
            });
            const hour = Math.floor((departure % 86400) / 3600);
            const peak = service === 'WD' && ((hour >= 6 && hour < 9) || (hour >= 16 && hour < 19));
            departure += peak ? plan.peak : plan.base;
          }
          continue;
        }

        const bands = BANDS[bandKey][service];
        if (!bands) continue;
        const tripId = `${route.id}-${direction}-${service}`;
        trips.push([route.id, service, tripId, headsign, direction]);
        ordered.forEach((stop, i) => {
          const t = toClock(TEMPLATE_START + offsets[i]);
          stopTimes.push([tripId, t, t, stop.id, i + 1]);
        });
        for (const [from, to, headway] of bands) {
          frequencies.push([tripId, `${from}:00`, `${to}:00`, headway, 0]);
        }
      }
    }
  }

  mkdirSync(OUT, { recursive: true });

  const files = {
    'agency.txt': csv(
      ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang'],
      [['OST', 'Ostgrad Transit', 'https://github.com/MrNedNick/transit-map', 'Europe/Berlin', 'en']],
    ),
    'feed_info.txt': csv(
      ['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'feed_start_date', 'feed_end_date', 'feed_version'],
      [['Ostgrad Transit', 'https://github.com/MrNedNick/transit-map', 'en', '20260101', '20261231', '2026.1']],
    ),
    'calendar.txt': csv(
      ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
      [
        ['WD', 1, 1, 1, 1, 1, 0, 0, '20260101', '20261231'],
        ['SA', 0, 0, 0, 0, 0, 1, 0, '20260101', '20261231'],
        ['SU', 0, 0, 0, 0, 0, 0, 1, '20260101', '20261231'],
        ['WE', 0, 0, 0, 0, 0, 1, 1, '20260101', '20261231'],
      ],
    ),
    'stops.txt': csv(
      ['stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'zone_id'],
      city.stops.map((s) => [s.id, s.name, round6(s.lat), round6(s.lon), s.district]),
    ),
    'routes.txt': csv(
      ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color', 'route_text_color'],
      routes,
    ),
    'trips.txt': csv(['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id'], trips),
    'stop_times.txt': csv(
      ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
      stopTimes,
    ),
    'frequencies.txt': csv(
      ['trip_id', 'start_time', 'end_time', 'headway_secs', 'exact_times'],
      frequencies,
    ),
  };

  let raw = 0;
  let gz = 0;
  const report = [];
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(OUT, name), body);
    const size = statSync(join(OUT, name)).size;
    const gzipped = gzipSync(body, { level: 9 }).length;
    raw += size;
    gz += gzipped;
    report.push([name, body.trimEnd().split('\n').length - 1, size, gzipped]);
  }

  console.log(`Ostgrad: ${city.stops.length} stops, ${city.routes.length} routes`);
  for (const [name, rows, size, gzipped] of report) {
    console.log(
      `  ${name.padEnd(18)} ${String(rows).padStart(7)} rows  ${(size / 1024).toFixed(0).padStart(5)} KB  ${(gzipped / 1024).toFixed(0).padStart(4)} KB gz`,
    );
  }
  console.log(`  ${'total'.padEnd(18)} ${''.padStart(7)}       ${(raw / 1024).toFixed(0).padStart(5)} KB  ${(gz / 1024).toFixed(0).padStart(4)} KB gz`);
}

build();
