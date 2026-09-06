import { vi } from 'vitest';
import { loadNetwork, loadTimetable, type Network, type Timetable } from '../lib/gtfs/feed';

/**
 * A city small enough to reason about by hand: six stops in a straight line,
 * 730 m apart, with a fast metro calling at every other one and a slow bus
 * calling at all of them. The numbers below are chosen so that every
 * assertion in the tests can be checked with arithmetic rather than by
 * running the code and writing down what it printed.
 */
const FILES: Record<string, string> = {
  'stops.txt': [
    'stop_id,stop_name,stop_lat,stop_lon,zone_id',
    'S1,Harbour Gate,49.0000,12.5000,Docks',
    'S2,Rope Walk,49.0000,12.5100,Docks',
    'S3,Old Mint,49.0000,12.5200,Oldtown',
    'S4,Mint Lane,49.0000,12.5300,Oldtown',
    'S5,North Yard,49.0000,12.5400,Northside',
    'S6,Clay Pits,49.0000,12.5500,Northside',
  ].join('\n'),

  'routes.txt': [
    'route_id,agency_id,route_short_name,route_long_name,route_type,route_color,route_text_color',
    'M1,OG,M1,Harbour Gate to North Yard,1,1d4ed8,ffffff',
    'B7,OG,7,Harbour Gate to Clay Pits,3,0f766e,ffffff',
    'B9,OG,9,Sunday market shuttle,3,b45309,ffffff',
  ].join('\n'),

  'calendar.txt': [
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
    'WD,1,1,1,1,1,0,0,20260101,20261231',
    'SU,0,0,0,0,0,0,1,20260101,20261231',
  ].join('\n'),

  'trips.txt': [
    'route_id,service_id,trip_id,trip_headsign,direction_id',
    'M1,WD,M1-WD,North Yard,0',
    'B7,WD,B7-WD,Clay Pits,0',
    'B9,SU,B9-SU,Old Mint,0',
  ].join('\n'),

  // The metro takes two minutes between the stops it calls at; the bus takes
  // three minutes between neighbours.
  'stop_times.txt': [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence',
    'M1-WD,08:00:00,08:00:00,S1,1',
    'M1-WD,08:02:00,08:02:00,S3,2',
    'M1-WD,08:04:00,08:04:00,S5,3',
    'B7-WD,08:00:00,08:00:00,S1,1',
    'B7-WD,08:03:00,08:03:00,S2,2',
    'B7-WD,08:06:00,08:06:00,S3,3',
    'B7-WD,08:09:00,08:09:00,S4,4',
    'B7-WD,08:12:00,08:12:00,S5,5',
    'B7-WD,08:15:00,08:15:00,S6,6',
    'B9-SU,10:00:00,10:00:00,S6,1',
    'B9-SU,10:07:00,10:07:00,S3,2',
    'B9-SU,10:14:00,10:14:00,S1,3',
  ].join('\n'),

  // Metro every 5 minutes, bus every 15, both only during the day. The Sunday
  // shuttle has no band at all, so it runs once at the printed time.
  'frequencies.txt': [
    'trip_id,start_time,end_time,headway_secs,exact_times',
    'M1-WD,06:00:00,22:00:00,300,0',
    'B7-WD,06:00:00,22:00:00,900,0',
  ].join('\n'),
};

/** Serves the fixture to the loaders in place of the network. */
export function installFeed(): void {
  vi.stubGlobal('fetch', async (url: string) => {
    const name = String(url).split('/').pop() as string;
    const body = FILES[name];
    if (body === undefined) {
      return { ok: false, status: 404, headers: { get: () => null }, text: async () => '' };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/csv' },
      text: async () => body,
    };
  });
}

export async function loadFixture(): Promise<{ network: Network; timetable: Timetable }> {
  installFeed();
  const network = await loadNetwork();
  const timetable = await loadTimetable(network);
  return { network, timetable };
}

/** GTFS calendar days, as `Date#getDay` numbers. */
export const WEDNESDAY = 3;
export const SUNDAY = 0;
