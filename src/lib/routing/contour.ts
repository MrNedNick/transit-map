/**
 * Marching squares: turns a scalar field into the outline of the region where
 * it stays at or below a level. Written here rather than pulled in because the
 * whole algorithm is one table and one walk, and the isochrone needs the rings
 * nested — outer boundaries carrying their holes — which most small
 * implementations leave to the caller anyway.
 */

export interface Field {
  /** Lattice values, row-major, `(width + 1) * (height + 1)` of them. */
  values: Float64Array;
  /** Cells across; the lattice is one point wider. */
  width: number;
  height: number;
}

type Ring = Array<[number, number]>;

/** Which edge of the lattice a crossing sits on, so two cells agree on it. */
const enum Side {
  Top,
  Right,
  Bottom,
  Left,
}

/**
 * For each of the sixteen corner combinations, the directed segments of the
 * contour: travelling along one keeps the region below the level on the left.
 * The two ambiguous saddles are resolved by the value in the middle of the
 * cell, so the outline follows whichever way the surface actually connects.
 */
const SEGMENTS: Array<Array<[Side, Side]>> = [
  [], // 0000
  [[Side.Left, Side.Top]], // 0001 top-left
  [[Side.Top, Side.Right]], // 0010 top-right
  [[Side.Left, Side.Right]], // 0011 top
  [[Side.Right, Side.Bottom]], // 0100 bottom-right
  [], // 0101 saddle
  [[Side.Top, Side.Bottom]], // 0110 right
  [[Side.Left, Side.Bottom]], // 0111
  [[Side.Bottom, Side.Left]], // 1000 bottom-left
  [[Side.Bottom, Side.Top]], // 1001 left
  [], // 1010 saddle
  [[Side.Bottom, Side.Right]], // 1011
  [[Side.Right, Side.Left]], // 1100 bottom
  [[Side.Right, Side.Top]], // 1101
  [[Side.Top, Side.Left]], // 1110
  [], // 1111
];

/**
 * The two ambiguous cases, resolved by the value in the middle of the cell:
 * `[case 5, case 10][joined, split]`.
 */
const SADDLES: Array<Array<Array<[Side, Side]>>> = [
  [
    [
      [Side.Right, Side.Top],
      [Side.Left, Side.Bottom],
    ],
    [
      [Side.Left, Side.Top],
      [Side.Right, Side.Bottom],
    ],
  ],
  [
    [
      [Side.Top, Side.Left],
      [Side.Bottom, Side.Right],
    ],
    [
      [Side.Top, Side.Right],
      [Side.Bottom, Side.Left],
    ],
  ],
];

export function contourRings(field: Field, level: number): Ring[] {
  const { values, width, height } = field;
  const stride = width + 1;
  const at = (x: number, y: number) => values[y * stride + x];

  // A crossing is named by the lattice edge it sits on, so the two cells that
  // share that edge produce exactly the same key and the ring closes. The key
  // is an index rather than a string, which is what keeps a quarter of a
  // million of them cheap.
  const slots = stride * (height + 1) * 2;
  const next = new Int32Array(slots).fill(-1);
  const pointX = new Float64Array(slots);
  const pointY = new Float64Array(slots);

  function crossing(x: number, y: number, side: Side): number {
    const a = at(x, y);
    const b = at(x + 1, y);
    const c = at(x + 1, y + 1);
    const d = at(x, y + 1);
    let key: number;
    let px: number;
    let py: number;

    switch (side) {
      case Side.Top:
        key = (y * stride + x) * 2;
        px = x + (level - a) / (b - a);
        py = y;
        break;
      case Side.Bottom:
        key = ((y + 1) * stride + x) * 2;
        px = x + (level - d) / (c - d);
        py = y + 1;
        break;
      case Side.Left:
        key = (y * stride + x) * 2 + 1;
        px = x;
        py = y + (level - a) / (d - a);
        break;
      default:
        key = (y * stride + x + 1) * 2 + 1;
        px = x + 1;
        py = y + (level - b) / (c - b);
        break;
    }
    pointX[key] = px;
    pointY[key] = py;
    return key;
  }

  const starts: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = at(x, y);
      const b = at(x + 1, y);
      const c = at(x + 1, y + 1);
      const d = at(x, y + 1);

      const index =
        (a <= level ? 1 : 0) | (b <= level ? 2 : 0) | (c <= level ? 4 : 0) | (d <= level ? 8 : 0);
      if (index === 0 || index === 15) continue;

      let segments = SEGMENTS[index];
      if (index === 5 || index === 10) {
        const joined = (a + b + c + d) / 4 <= level;
        segments = SADDLES[index === 5 ? 0 : 1][joined ? 0 : 1];
      }

      for (const [from, to] of segments) {
        const key = crossing(x, y, from);
        next[key] = crossing(x, y, to);
        starts.push(key);
      }
    }
  }

  const rings: Ring[] = [];
  const seen = new Uint8Array(slots);
  for (const start of starts) {
    if (seen[start]) continue;
    const ring: Ring = [];
    let key = start;
    while (key !== -1 && !seen[key]) {
      seen[key] = 1;
      ring.push([pointX[key], pointY[key]]);
      key = next[key];
    }
    // Three points is the smallest thing that encloses any area at all.
    if (ring.length >= 3) {
      ring.push(ring[0]);
      rings.push(ring);
    }
  }

  return rings;
}

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function boxOf(ring: Ring): Box {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

function contains(ring: Ring, box: Box, point: [number, number]): boolean {
  // Rings run to thousands of points, so the cheap rejection comes first.
  if (
    point[0] < box.minX ||
    point[0] > box.maxX ||
    point[1] < box.minY ||
    point[1] > box.maxY
  ) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > point[1] !== yj > point[1]) {
      const x = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (point[0] < x) inside = !inside;
    }
  }
  return inside;
}

/** Twice the signed area: positive when the ring runs anticlockwise. */
function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

/**
 * Groups the rings into polygons: a ring sitting inside an odd number of other
 * rings is a hole in the innermost one, anything else starts a new polygon.
 */
export function ringsToPolygons(
  rings: Ring[],
  project: (x: number, y: number) => [number, number],
): GeoJSON.MultiPolygon {
  const boxes = rings.map(boxOf);
  const areas = rings.map((ring) => Math.abs(signedArea(ring)));

  const depth = rings.map((ring, i) => {
    let count = 0;
    for (let j = 0; j < rings.length; j++) {
      if (j !== i && contains(rings[j], boxes[j], ring[0])) count++;
    }
    return count;
  });

  const outers = rings.map((_, i) => i).filter((i) => depth[i] % 2 === 0);
  const polygons = outers.map((i) => [rings[i]]);

  for (let i = 0; i < rings.length; i++) {
    if (depth[i] % 2 === 0) continue;
    // The hole belongs to the tightest outer ring around it.
    let host = -1;
    for (let p = 0; p < outers.length; p++) {
      const outer = outers[p];
      if (!contains(rings[outer], boxes[outer], rings[i][0])) continue;
      if (host === -1 || areas[outer] < areas[outers[host]]) host = p;
    }
    if (host !== -1) polygons[host].push(rings[i]);
  }

  const coordinates = polygons.map((polygon) =>
    polygon.map((ring, index) => {
      const projected = ring.map(([x, y]) => project(x, y));
      // GeoJSON wants the outline anticlockwise and its holes the other way.
      const anticlockwise = signedArea(projected as Ring) > 0;
      const wantAnticlockwise = index === 0;
      return anticlockwise === wantAnticlockwise ? projected : projected.reverse();
    }),
  );

  return { type: 'MultiPolygon', coordinates };
}
