/** Everything the shell needs to link out, and the copy of the page, in one place. */
export const site = {
  name: 'Transit Map',
  city: 'Ostgrad',
  repo: 'https://github.com/MrNedNick/transit-map',
  readme: 'https://github.com/MrNedNick/transit-map#readme',
  demo: 'https://mrnednick.github.io/transit-map/',
} as const;

export interface Step {
  title: string;
  body: string;
}

export const steps: Step[] = [
  {
    title: 'Pick a stop',
    body:
      'Click a dot on the map or type a name into the search box. Zoomed out, stops ' +
      'gather into clusters; clicking one opens it at the zoom where it breaks apart.',
  },
  {
    title: 'Choose an hour',
    body:
      'The time slider is a slice of the timetable rather than a dimmer. At three in ' +
      'the morning the map is left with the ten routes that actually run and the 291 ' +
      'stops they call at.',
  },
  {
    title: 'See how far you get',
    body:
      'Set a travel budget and the map shades everywhere you could be by then — the ' +
      'ride, the wait for it, and the walk at either end.',
  },
];

export interface Feature {
  title: string;
  body: string;
  icon: string;
}

export const features: Feature[] = [
  {
    title: 'No tile server',
    body:
      'The basemap is a single 328 KB PMTiles archive read with range requests, so ' +
      'only the tiles on screen come down. There is no key to rotate and no bill.',
    icon: 'M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3zM9 4v13M15 7v13',
  },
  {
    title: 'A real timetable',
    body:
      '213 routes, 1,462 trip patterns and 31,404 stop times, with the frequency ' +
      'bands behind them. Departures are read from the calendar, not from a lookup ' +
      'table of pretty numbers.',
    icon: 'M4 5h16v15H4zM4 9h16M9 3v4M15 3v4M8 13h3M8 16h6',
  },
  {
    title: 'Isochrones in the browser',
    body:
      'A frequency-based RAPTOR walks the network, a grid turns the result into a ' +
      'walking-time surface, and marching squares cut the outline. Tens of ' +
      'milliseconds per area, with nothing to ask a server.',
    icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7a5 5 0 100 10 5 5 0 000-10zM12 11v1',
  },
  {
    title: 'The link is the view',
    body:
      'Camera, modes, hour, day, the open stop and the travel budget all live in the ' +
      'address bar. Send the link and the other person opens exactly your screen.',
    icon: 'M10 14a4 4 0 006 0l3-3a4 4 0 10-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 106 6l1-1',
  },
];
