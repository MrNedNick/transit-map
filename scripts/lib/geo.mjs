/**
 * The city is small enough (roughly 25 x 19 km) that a local equirectangular
 * projection is accurate to well under a metre — no need for a real projection
 * library just to place stops.
 */
export const EARTH_R = 6371008.8;

export function metresPerDegree(lat) {
  const latRad = (lat * Math.PI) / 180;
  return {
    lon: ((Math.PI * EARTH_R) / 180) * Math.cos(latRad),
    lat: (Math.PI * EARTH_R) / 180,
  };
}

/** Haversine, in metres. */
export function distance(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/** Catmull-Rom through the control points, sampled every `steps` segments. */
export function smoothPath(points, steps = 12) {
  if (points.length < 3) return points.slice();
  const pts = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Walk a polyline and emit a point every `spacing` metres. */
export function sampleAlong(path, spacing) {
  const out = [path[0]];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = distance(path[i - 1], path[i]);
    if (segLen === 0) continue;
    let pos = spacing - carry;
    while (pos <= segLen) {
      const t = pos / segLen;
      out.push([
        path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
        path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t,
      ]);
      pos += spacing;
    }
    carry = (carry + segLen) % spacing;
  }
  const last = path[path.length - 1];
  if (distance(out[out.length - 1], last) > spacing * 0.45) out.push(last);
  return out;
}

/** Uniform grid for "what is near this point" lookups. */
export class SpatialGrid {
  constructor(cellMetres, lat) {
    const mpd = metresPerDegree(lat);
    this.cellLon = cellMetres / mpd.lon;
    this.cellLat = cellMetres / mpd.lat;
    this.cells = new Map();
  }

  key(lon, lat) {
    return `${Math.floor(lon / this.cellLon)}:${Math.floor(lat / this.cellLat)}`;
  }

  add(item, lon, lat) {
    const k = this.key(lon, lat);
    let bucket = this.cells.get(k);
    if (!bucket) this.cells.set(k, (bucket = []));
    bucket.push(item);
  }

  near(lon, lat, rings = 1) {
    const cx = Math.floor(lon / this.cellLon);
    const cy = Math.floor(lat / this.cellLat);
    const out = [];
    for (let dx = -rings; dx <= rings; dx++) {
      for (let dy = -rings; dy <= rings; dy++) {
        const bucket = this.cells.get(`${cx + dx}:${cy + dy}`);
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }
}
