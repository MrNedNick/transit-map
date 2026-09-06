import { beforeAll, describe, expect, it } from 'vitest';
import type { Network, Timetable } from '../lib/gtfs/feed';
import { departuresAt } from '../lib/gtfs/feed';
import { activeAt } from '../lib/gtfs/active';
import { stopDetails } from '../lib/gtfs/stop-details';
import { searchStops } from '../lib/search';
import { reachFrom } from '../lib/routing/reach';
import { isochroneFrom } from '../lib/routing/isochrone';
import { SUNDAY, WEDNESDAY, loadFixture } from './fixture';

/**
 * The scenario the product exists for, end to end on a feed small enough to
 * check by hand: find a stop, narrow the map to one kind of transport, read
 * the stop's card, and see how far the network takes you from it.
 */
describe('finding a stop and seeing how far it goes', () => {
  let network: Network;
  let timetable: Timetable;

  beforeAll(async () => {
    ({ network, timetable } = await loadFixture());
  });

  it('finds a stop by name, preferring the one the query starts', () => {
    const hits = searchStops(network.stops, 'mint');
    expect(hits.map((hit) => hit.stop.name)).toEqual(['Mint Lane', 'Old Mint']);
  });

  it('ignores a query too short to mean anything', () => {
    expect(searchStops(network.stops, 'm')).toEqual([]);
  });

  it('leaves only what runs at the chosen hour on the chosen kind of day', () => {
    const weekday = activeAt(network, timetable, {
      hour: 8,
      weekday: WEDNESDAY,
      modes: ['metro', 'tram', 'rail', 'bus'],
    });
    expect(weekday.routeIds.sort()).toEqual(['B7', 'M1']);
    expect(weekday.stopIds.size).toBe(6);

    // The Sunday shuttle runs once at ten, and nothing else runs on a Sunday.
    const sunday = activeAt(network, timetable, {
      hour: 10,
      weekday: SUNDAY,
      modes: ['metro', 'tram', 'rail', 'bus'],
    });
    expect(sunday.routeIds).toEqual(['B9']);
    expect(sunday.stopIds.size).toBe(3);

    const nightWeekday = activeAt(network, timetable, {
      hour: 3,
      weekday: WEDNESDAY,
      modes: ['metro', 'tram', 'rail', 'bus'],
    });
    expect(nightWeekday.routeIds).toEqual([]);
  });

  it('filters by kind of transport', () => {
    const metroOnly = activeAt(network, timetable, {
      hour: 8,
      weekday: WEDNESDAY,
      modes: ['metro'],
    });
    expect(metroOnly.routeIds).toEqual(['M1']);
    // The metro calls at every other stop, so three of the six.
    expect([...metroOnly.stopIds].sort()).toEqual(['S1', 'S3', 'S5']);
  });

  it('reads a stop card: which lines call, where they go, when they leave', () => {
    const stop = network.stopById.get('S3') as NonNullable<
      ReturnType<Network['stopById']['get']>
    >;
    const details = stopDetails(network, timetable, stop, {
      hour: 8,
      weekday: WEDNESDAY,
      activeRouteIds: new Set(['M1', 'B7']),
    });

    // Every line that calls here is listed, including the Sunday shuttle —
    // it is marked as not running rather than left out.
    expect(details.routes.map((route) => route.routeId).sort()).toEqual(['B7', 'B9', 'M1']);
    expect(details.routes.filter((route) => route.running).map((r) => r.routeId).sort()).toEqual([
      'B7',
      'M1',
    ]);
    // The ones that run are listed first.
    expect(details.routes[details.routes.length - 1].routeId).toBe('B9');
    expect(details.routes.find((route) => route.routeId === 'M1')?.headsigns).toEqual([
      'North Yard',
    ]);
    expect(details.neverServed).toBe(false);

    // The board carries one line per route and headsign, not eight copies of
    // the same metro because its band produced eight departures.
    const metro = details.departures.filter((d) => d.routeId === 'M1');
    expect(metro).toHaveLength(1);
    expect(metro[0].approximate).toBe(true);
    expect(metro[0].headway).toBe(300);
    // Every five minutes, so the wait from eight o'clock is never longer.
    expect(metro[0].time - 8 * 3600).toBeLessThanOrEqual(300);
    expect(details.departures.map((d) => d.routeId).sort()).toEqual(['B7', 'M1']);
  });

  it('says a line is not running rather than hiding it', () => {
    const stop = network.stopById.get('S3') as NonNullable<
      ReturnType<Network['stopById']['get']>
    >;
    const details = stopDetails(network, timetable, stop, {
      hour: 10,
      weekday: SUNDAY,
      activeRouteIds: new Set(['B9']),
    });

    const notRunning = details.routes.filter((route) => !route.running).map((r) => r.routeId);
    expect(notRunning.sort()).toEqual(['B7', 'M1']);
    expect(details.routes.find((route) => route.routeId === 'B9')?.running).toBe(true);
  });

  it('leaves the departure board empty when nothing runs, without pretending', () => {
    const stop = network.stopById.get('S3') as NonNullable<
      ReturnType<Network['stopById']['get']>
    >;
    const details = stopDetails(network, timetable, stop, { hour: 3, weekday: WEDNESDAY });
    expect(details.departures).toEqual([]);
    // The stop is in the feed and has lines — it is the hour that is empty.
    expect(details.neverServed).toBe(false);
    expect(details.routes.length).toBeGreaterThan(0);
  });

  it('does not read a departure hours past the one being asked about', () => {
    const board = departuresAt(network, timetable, {
      stopId: 'S3',
      from: 3 * 3600,
      weekday: WEDNESDAY,
    });
    expect(board).toEqual([]);
  });
});

describe('how far the network takes you', () => {
  let network: Network;
  let timetable: Timetable;

  beforeAll(async () => {
    ({ network, timetable } = await loadFixture());
  });

  const allModes = ['metro', 'tram', 'rail', 'bus'] as const;

  it('rides the fast line rather than the slow one', () => {
    const reach = reachFrom(network, timetable, 'S1', {
      hour: 8,
      weekday: WEDNESDAY,
      modes: [...allModes],
      budget: 15 * 60,
    });
    expect(reach).not.toBeNull();

    const at = (id: string) =>
      (reach as NonNullable<typeof reach>).costs[
        network.stops.findIndex((stop) => stop.id === id)
      ];

    // Metro: 150 s of expected wait plus four minutes to the end of the line.
    expect(at('S5')).toBeCloseTo(150 + 240, 0);
    // S3 is on both lines; the metro gets there first.
    expect(at('S3')).toBeCloseTo(150 + 120, 0);
    // S6 is bus only: 450 s of wait plus fifteen minutes of riding is over
    // budget, so the only way there is the walk from S5.
    expect(at('S6')).toBeGreaterThan(150 + 240);
  });

  it('shrinks when a kind of transport is switched off', () => {
    const withMetro = reachFrom(network, timetable, 'S1', {
      hour: 8,
      weekday: WEDNESDAY,
      modes: [...allModes],
      budget: 10 * 60,
    });
    const busOnly = reachFrom(network, timetable, 'S1', {
      hour: 8,
      weekday: WEDNESDAY,
      modes: ['bus'],
      budget: 10 * 60,
    });

    expect(withMetro?.stopsReached).toBeGreaterThan(busOnly?.stopsReached as number);
  });

  it('gives an area that grows with the time budget', () => {
    const shape = (minutes: number) =>
      isochroneFrom(network, timetable, 'S1', {
        hour: 8,
        weekday: WEDNESDAY,
        modes: [...allModes],
        minutes,
      });

    const ten = shape(10);
    const twenty = shape(20);
    expect(ten).not.toBeNull();
    expect(twenty).not.toBeNull();

    expect((ten as NonNullable<typeof ten>).area.coordinates.length).toBeGreaterThan(0);
    expect((twenty as NonNullable<typeof twenty>).squareKm).toBeGreaterThan(
      (ten as NonNullable<typeof ten>).squareKm,
    );
    // Ten minutes on foot alone is about 1.4 km across; the metro has to make
    // it bigger than that or the isochrone is not using the network at all.
    expect((ten as NonNullable<typeof ten>).squareKm).toBeGreaterThan(2);
  });

  it('is only a walk when nothing runs from the stop', () => {
    const walking = isochroneFrom(network, timetable, 'S1', {
      hour: 3,
      weekday: WEDNESDAY,
      modes: [...allModes],
      minutes: 15,
    });
    expect(walking).not.toBeNull();
    // 15 minutes at 1.35 m/s is a circle of radius 1.2 km: about 4.6 km².
    expect((walking as NonNullable<typeof walking>).squareKm).toBeGreaterThan(4);
    expect((walking as NonNullable<typeof walking>).squareKm).toBeLessThan(5.5);
  });

  it('refuses a stop that is not in the feed instead of guessing', () => {
    expect(
      isochroneFrom(network, timetable, 'nowhere', {
        hour: 8,
        weekday: WEDNESDAY,
        modes: [...allModes],
        minutes: 15,
      }),
    ).toBeNull();
  });
});
