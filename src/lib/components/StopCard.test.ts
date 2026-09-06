import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import StopCard from './StopCard.svelte';
import type { Network, Timetable } from '../gtfs/feed';
import { stopDetails } from '../gtfs/stop-details';
import { SUNDAY, WEDNESDAY, loadFixture } from '../../test/fixture';
import type { Stop } from '../gtfs/types';

describe('the stop card', () => {
  let network: Network;
  let timetable: Timetable;

  beforeAll(async () => {
    ({ network, timetable } = await loadFixture());
  });

  beforeEach(() => {
    localStorage.clear();
  });

  const detailsFor = (hour: number, weekday: number, running: string[]) =>
    stopDetails(network, timetable, network.stopById.get('S3') as Stop, {
      hour,
      weekday,
      activeRouteIds: new Set(running),
    });

  it('shows the lines that call and where they go', () => {
    render(StopCard, {
      details: detailsFor(8, WEDNESDAY, ['M1', 'B7']),
      isochrone: null,
      hour: 8,
      day: 'wd',
      minutes: 15,
      onminutes: () => {},
      onclose: () => {},
    });

    expect(screen.getByRole('heading', { name: 'Old Mint' })).toBeInTheDocument();
    expect(screen.getByText(/to North Yard/)).toBeInTheDocument();
    expect(screen.getByText(/to Clay Pits/)).toBeInTheDocument();
    // The Sunday shuttle calls here but is not running on a Wednesday.
    expect(screen.getByText(/not running now/)).toBeInTheDocument();
  });

  it('says plainly that nothing leaves rather than showing an empty list', () => {
    render(StopCard, {
      details: detailsFor(3, WEDNESDAY, []),
      isochrone: null,
      hour: 3,
      day: 'wd',
      minutes: 15,
      onminutes: () => {},
      onclose: () => {},
    });

    expect(screen.getByText(/Nothing leaves this stop after 03:00 on a weekday/)).toBeInTheDocument();
  });

  it('names the day properly in a sentence', () => {
    render(StopCard, {
      details: detailsFor(23, SUNDAY, []),
      isochrone: null,
      hour: 23,
      day: 'su',
      minutes: 15,
      onminutes: () => {},
      onclose: () => {},
    });

    // Both the departure board and the reachable-area note name the day, and
    // both have to read as a sentence rather than as "on a sunday".
    expect(screen.getAllByText(/on a Sunday/)).toHaveLength(2);
  });

  it('reports what the travel budget buys, and asks for a new one', async () => {
    const onminutes = vi.fn();
    render(StopCard, {
      details: detailsFor(8, WEDNESDAY, ['M1', 'B7']),
      isochrone: { area: { type: 'MultiPolygon', coordinates: [] }, stopsReached: 42, squareKm: 3.25, minutes: 15, millis: 8 },
      hour: 8,
      day: 'wd',
      minutes: 15,
      onminutes,
      onclose: () => {},
    });

    expect(screen.getByRole('heading', { name: /Where 15 minutes gets you/i })).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('3.3 km²')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/Reachable in/i), '30');
    expect(onminutes).toHaveBeenCalledWith(30);
  });

  it('saves the stop and remembers it', async () => {
    render(StopCard, {
      details: detailsFor(8, WEDNESDAY, ['M1', 'B7']),
      isochrone: null,
      hour: 8,
      day: 'wd',
      minutes: 15,
      onminutes: () => {},
      onclose: () => {},
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save stop' }));
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument();
    expect(localStorage.getItem('transit-map:saved')).toContain('Old Mint');
  });
});
