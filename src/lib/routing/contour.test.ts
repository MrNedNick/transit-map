import { describe, expect, it } from 'vitest';
import { contourRings, ringsToPolygons, type Field } from './contour';

const SIZE = 24;

/** A lattice of `SIZE` cells a side, filled by a function of its coordinates. */
function field(value: (x: number, y: number) => number): Field {
  const stride = SIZE + 1;
  const values = new Float64Array(stride * stride);
  for (let y = 0; y <= SIZE; y++) {
    for (let x = 0; x <= SIZE; x++) values[y * stride + x] = value(x, y);
  }
  return { values, width: SIZE, height: SIZE };
}

const distance = (x: number, y: number) => Math.hypot(x - 12, y - 12);

/** Positive when the ring runs anticlockwise, which is what GeoJSON wants. */
function shoelace(ring: Array<[number, number]>): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

// Latitude runs the other way from a grid row, so the projection flips y —
// the same way the isochrone's does.
const project = (x: number, y: number): [number, number] => [x, SIZE - y];

describe('marching squares', () => {
  it('draws one closed outline around a single blob', () => {
    const rings = contourRings(field(distance), 6);
    expect(rings).toHaveLength(1);
    expect(rings[0][0]).toEqual(rings[0][rings[0].length - 1]);

    const polygons = ringsToPolygons(rings, project);
    expect(polygons.coordinates).toHaveLength(1);
    expect(polygons.coordinates[0]).toHaveLength(1);
  });

  it('places the outline where the values actually cross the level', () => {
    const rings = contourRings(field(distance), 6);
    for (const [x, y] of rings[0]) {
      expect(Math.hypot(x - 12, y - 12)).toBeCloseTo(6, 1);
    }
  });

  it('keeps a hole a hole', () => {
    // Low on a ring at radius 8, high in the middle and outside it.
    const rings = contourRings(field((x, y) => Math.abs(distance(x, y) - 8)), 2);
    expect(rings).toHaveLength(2);

    const polygons = ringsToPolygons(rings, project);
    expect(polygons.coordinates).toHaveLength(1);
    const [outer, hole] = polygons.coordinates[0];
    expect(hole).toBeDefined();

    // The hole is the smaller of the two, and wound the opposite way.
    expect(Math.abs(shoelace(hole as Array<[number, number]>))).toBeLessThan(
      Math.abs(shoelace(outer as Array<[number, number]>)),
    );
    expect(shoelace(outer as Array<[number, number]>)).toBeGreaterThan(0);
    expect(shoelace(hole as Array<[number, number]>)).toBeLessThan(0);
  });

  it('treats an island inside a hole as its own polygon', () => {
    // A disc in the middle, a gap, then a ring around it.
    const rings = contourRings(
      field((x, y) => Math.min(Math.abs(distance(x, y) - 8), distance(x, y))),
      2,
    );
    expect(rings).toHaveLength(3);

    const polygons = ringsToPolygons(rings, project);
    expect(polygons.coordinates).toHaveLength(2);
    const withHole = polygons.coordinates.find((polygon) => polygon.length === 2);
    const island = polygons.coordinates.find((polygon) => polygon.length === 1);
    expect(withHole).toBeDefined();
    expect(island).toBeDefined();
    expect(shoelace(island?.[0] as Array<[number, number]>)).toBeGreaterThan(0);
  });

  it('finds every separate area rather than merging them', () => {
    const twoBlobs = field((x, y) =>
      Math.min(Math.hypot(x - 6, y - 12), Math.hypot(x - 18, y - 12)),
    );
    const polygons = ringsToPolygons(contourRings(twoBlobs, 3), project);
    expect(polygons.coordinates).toHaveLength(2);
  });

  it('has nothing to draw when the whole field is on one side of the level', () => {
    expect(contourRings(field(() => 1), 5)).toEqual([]);
    expect(contourRings(field(() => 9), 5)).toEqual([]);
  });
});
