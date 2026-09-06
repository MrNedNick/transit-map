import { makeRng, pick, range, intRange } from './rng.mjs';
import { distance, metresPerDegree, smoothPath, sampleAlong, SpatialGrid } from './geo.mjs';
import { DISTRICTS, LANDMARKS, TREES, STREET_KINDS } from './names.mjs';

export const CITY = {
  name: 'Ostgrad',
  centre: [12.5, 49.0],
  widthKm: 25,
  heightKm: 19,
  seed: 20260906,
};

/** GTFS route_type -> everything the generator and the map need to know. */
/** Named lines get their own colour, the way a real network map does. */
export const LINE_COLOURS = {
  metro: ['d2262c', '1d4ed8', '0f8f4a', 'e08a13'],
  tram: ['b45309', '8a5a2b', 'a3123f', '6d28d9', '0e7490', '4d7c0f', 'be185d', '9a3412', '0369a1'],
  rail: ['7c3aed', '2563eb', '059669', 'db2777'],
};

export const MODES = {
  tram: { routeType: 0, spacing: 460, speedKmh: 19, colour: 'b45309', width: 2.2 },
  metro: { routeType: 1, spacing: 950, speedKmh: 36, colour: '1d4ed8', width: 3.2 },
  rail: { routeType: 2, spacing: 2600, speedKmh: 58, colour: '7c3aed', width: 2.6 },
  bus: { routeType: 3, spacing: 360, speedKmh: 15, colour: '0f766e', width: 1.5 },
};

function bboxOf(centre, widthKm, heightKm) {
  const mpd = metresPerDegree(centre[1]);
  const halfLon = (widthKm * 1000) / 2 / mpd.lon;
  const halfLat = (heightKm * 1000) / 2 / mpd.lat;
  return [centre[0] - halfLon, centre[1] - halfLat, centre[0] + halfLon, centre[1] + halfLat];
}

/** 0 at the city centre, 1 at the far corner. */
function radial(pt, centre, bbox) {
  const nx = (pt[0] - centre[0]) / ((bbox[2] - bbox[0]) / 2);
  const ny = (pt[1] - centre[1]) / ((bbox[3] - bbox[1]) / 2);
  return Math.min(1, Math.hypot(nx, ny));
}

/** Closed ring around a centre with wobbling radius — lakes, parks, built-up area. */
function blob(rng, centre, radiusMetres, wobble, points, lat) {
  const mpd = metresPerDegree(lat);
  const phase = [rng() * 7, rng() * 7, rng() * 7];
  const ring = [];
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r =
      radiusMetres *
      (1 +
        wobble *
          (0.55 * Math.sin(3 * a + phase[0]) +
            0.3 * Math.sin(5 * a + phase[1]) +
            0.15 * Math.sin(8 * a + phase[2])));
    ring.push([centre[0] + (Math.cos(a) * r) / mpd.lon, centre[1] + (Math.sin(a) * r) / mpd.lat]);
  }
  ring[ring.length - 1] = ring[0].slice();
  return ring;
}

/** Turn a polyline into a polygon by offsetting each side — good enough for a river. */
function ribbon(path, widthAt, lat) {
  const mpd = metresPerDegree(lat);
  const left = [];
  const right = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    const dx = (next[0] - prev[0]) * mpd.lon;
    const dy = (next[1] - prev[1]) * mpd.lat;
    const len = Math.hypot(dx, dy) || 1;
    const half = widthAt(i / (path.length - 1)) / 2;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    left.push([path[i][0] + nx / mpd.lon, path[i][1] + ny / mpd.lat]);
    right.push([path[i][0] - nx / mpd.lon, path[i][1] - ny / mpd.lat]);
  }
  const ring = [...left, ...right.reverse()];
  ring.push(ring[0].slice());
  return ring;
}

function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function buildCity() {
  const rng = makeRng(CITY.seed);
  const centre = CITY.centre;
  const bbox = bboxOf(centre, CITY.widthKm, CITY.heightKm);
  const mpd = metresPerDegree(centre[1]);
  const lat = centre[1];

  // ------------------------------------------------------------------ water
  const riverControls = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    riverControls.push([
      bbox[0] + (bbox[2] - bbox[0]) * (0.38 + 0.22 * Math.sin(t * 3.1 + 0.6) + range(rng, -0.03, 0.03)),
      bbox[1] + (bbox[3] - bbox[1]) * t,
    ]);
  }
  const riverPath = smoothPath(riverControls, 14);
  const river = ribbon(riverPath, (t) => 70 + 150 * t + 40 * Math.sin(t * 9), lat);

  const lakeCentre = [
    centre[0] + (5200 / mpd.lon) * 1,
    centre[1] + (4200 / mpd.lat) * 1,
  ];
  const lake = blob(rng, lakeCentre, 1450, 0.3, 48, lat);
  const water = [river, lake];

  const inWater = (pt) => water.some((ring) => pointInRing(pt, ring));

  // ------------------------------------------------------------- built-up area
  const urban = blob(rng, centre, 8600, 0.16, 64, lat);
  const inUrban = (pt) => pointInRing(pt, urban);

  // ------------------------------------------------------------------ parks
  const parks = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rng();
    const d = range(rng, 1200, 8000);
    const c = [centre[0] + (Math.cos(a) * d) / mpd.lon, centre[1] + (Math.sin(a) * d) / mpd.lat];
    if (inWater(c)) continue;
    parks.push({
      name: `${pick(rng, DISTRICTS)} ${pick(rng, ['Park', 'Gardens', 'Common', 'Green', 'Meadows'])}`,
      ring: blob(rng, c, range(rng, 320, 900), 0.26, 30, lat),
    });
  }

  // -------------------------------------------------------------- districts
  const districts = DISTRICTS.map((name, i) => {
    const a = (i / DISTRICTS.length) * Math.PI * 2 + 0.4;
    const d = i === 0 ? 0 : range(rng, 1800, 9200);
    return {
      name,
      centre: [centre[0] + (Math.cos(a) * d) / mpd.lon, centre[1] + (Math.sin(a) * d) / mpd.lat],
    };
  });

  const districtOf = (pt) => {
    let best = districts[0];
    let bestD = Infinity;
    for (const d of districts) {
      const dist = distance(pt, d.centre);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best.name;
  };

  // ------------------------------------------------------------------ roads
  const roads = [];
  const ringRoad = blob(rng, centre, 7200, 0.12, 56, lat);
  roads.push({ kind: 'ring', line: ringRoad });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15;
    const controls = [];
    for (let s = 0; s <= 5; s++) {
      const d = (s / 5) * 11500;
      const wob = range(rng, -0.12, 0.12) * (s === 0 ? 0 : 1);
      controls.push([
        centre[0] + (Math.cos(a + wob) * d) / mpd.lon,
        centre[1] + (Math.sin(a + wob) * d) / mpd.lat,
      ]);
    }
    roads.push({ kind: 'arterial', line: smoothPath(controls, 10) });
  }
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const d = range(rng, 400, 7000);
    const from = [centre[0] + (Math.cos(a) * d) / mpd.lon, centre[1] + (Math.sin(a) * d) / mpd.lat];
    const heading = rng() * Math.PI * 2;
    const len = range(rng, 900, 3200);
    const controls = [from];
    for (let s = 1; s <= 3; s++) {
      const dd = (len * s) / 3;
      const h = heading + range(rng, -0.3, 0.3);
      controls.push([from[0] + (Math.cos(h) * dd) / mpd.lon, from[1] + (Math.sin(h) * dd) / mpd.lat]);
    }
    roads.push({ kind: 'street', line: smoothPath(controls, 8) });
  }

  // ------------------------------------------------------- stops and routes
  const stops = [];
  const grid = new SpatialGrid(200, lat);
  const usedNames = new Set();

  function nameFor(pt, district) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate =
        rng() < 0.55
          ? `${district} ${pick(rng, LANDMARKS)}`
          : `${pick(rng, TREES)} ${pick(rng, STREET_KINDS)}`;
      if (!usedNames.has(candidate)) {
        usedNames.add(candidate);
        return candidate;
      }
    }
    let n = 2;
    let base = `${district} ${pick(rng, LANDMARKS)}`;
    while (usedNames.has(`${base} ${n}`)) n++;
    usedNames.add(`${base} ${n}`);
    return `${base} ${n}`;
  }

  /** Reuse a nearby stop when one exists, so routes genuinely share platforms. */
  function stopAt(pt, snapMetres) {
    let best = null;
    let bestD = snapMetres;
    for (const s of grid.near(pt[0], pt[1], 1)) {
      const d = distance(pt, [s.lon, s.lat]);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best) return best;
    const district = districtOf(pt);
    const stop = {
      id: `S${String(stops.length + 1).padStart(5, '0')}`,
      name: nameFor(pt, district),
      lon: pt[0],
      lat: pt[1],
      district,
      modes: new Set(),
    };
    stops.push(stop);
    grid.add(stop, stop.lon, stop.lat);
    return stop;
  }

  function corridor(fromAngle, toAngle, fromDist, toDist, bend) {
    const a = [
      centre[0] + (Math.cos(fromAngle) * fromDist) / mpd.lon,
      centre[1] + (Math.sin(fromAngle) * fromDist) / mpd.lat,
    ];
    const b = [
      centre[0] + (Math.cos(toAngle) * toDist) / mpd.lon,
      centre[1] + (Math.sin(toAngle) * toDist) / mpd.lat,
    ];
    const controls = [a];
    const steps = 4;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      controls.push([
        a[0] + (b[0] - a[0]) * t + (bend * Math.sin(t * Math.PI) * 2600) / mpd.lon,
        a[1] + (b[1] - a[1]) * t + (bend * Math.cos(t * Math.PI) * 2100) / mpd.lat,
      ]);
    }
    controls.push(b);
    return smoothPath(controls, 12);
  }

  const routes = [];
  let routeSeq = 0;

  function addRoute(mode, shortName, path, snapMetres) {
    const cfg = MODES[mode];
    const points = sampleAlong(path, cfg.spacing);
    const seq = [];
    for (const pt of points) {
      if (mode !== 'rail' && inWater(pt)) continue;
      const stop = stopAt(pt, snapMetres);
      if (seq.length && seq[seq.length - 1] === stop) continue;
      stop.modes.add(mode);
      seq.push(stop);
    }
    if (seq.length < 5) return null;
    const route = {
      id: `R${String(++routeSeq).padStart(3, '0')}`,
      mode,
      routeType: cfg.routeType,
      shortName,
      longName: `${seq[0].name} – ${seq[seq.length - 1].name}`,
      colour: LINE_COLOURS[mode]
        ? LINE_COLOURS[mode][routes.filter((r) => r.mode === mode).length % LINE_COLOURS[mode].length]
        : cfg.colour,
      stops: seq,
      path: seq.map((s) => [s.lon, s.lat]),
      night: false,
    };
    routes.push(route);
    return route;
  }

  // Metro: four long lines crossing near the centre.
  const metroAngles = [
    [Math.PI * 0.52, Math.PI * 1.55, 0.05],
    [Math.PI * 0.05, Math.PI * 1.02, -0.06],
    [Math.PI * 0.78, Math.PI * 1.82, 0.08],
    [Math.PI * 0.28, Math.PI * 1.3, -0.04],
  ];
  metroAngles.forEach(([from, to, bend], i) => {
    addRoute('metro', `M${i + 1}`, corridor(from, to, 8600, 8900, bend), 260);
  });

  // Suburban rail: long radials that leave the built-up area.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    addRoute('rail', `S${i + 1}`, corridor(a, a + Math.PI, 11800, 11200, range(rng, -0.05, 0.05)), 320);
  }

  // Trams: medium, mostly inside the ring road.
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2;
    const b = a + range(rng, Math.PI * 0.55, Math.PI * 1.45);
    addRoute('tram', `${i + 1}`, corridor(a, b, range(rng, 3800, 7400), range(rng, 3800, 7400), range(rng, -0.35, 0.35)), 190);
  }

  // Buses: the bulk of the network, laid down until the city is covered.
  const busTargets = 196;
  for (let i = 0; i < busTargets; i++) {
    const a = rng() * Math.PI * 2;
    const b = a + range(rng, Math.PI * 0.35, Math.PI * 1.6);
    const route = addRoute(
      'bus',
      String(100 + i),
      corridor(a, b, range(rng, 2200, 10800), range(rng, 2200, 11200), range(rng, -0.55, 0.55)),
      120,
    );
    if (route && i >= busTargets - 10) {
      route.night = true;
      route.shortName = `N${i - (busTargets - 10) + 1}`;
    }
  }

  return {
    ...CITY,
    bbox,
    water,
    lake,
    river,
    urban,
    parks,
    districts,
    roads,
    stops,
    routes,
    inUrban,
  };
}
