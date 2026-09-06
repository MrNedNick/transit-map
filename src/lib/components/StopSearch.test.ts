import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import StopSearch from './StopSearch.svelte';
import type { Network } from '../gtfs/feed';
import { loadFixture } from '../../test/fixture';

describe('finding a stop by name', () => {
  let network: Network;

  beforeAll(async () => {
    ({ network } = await loadFixture());
  });

  it('says nothing until the query is worth searching for', async () => {
    render(StopSearch, { stops: network.stops, onselect: () => {} });
    const box = screen.getByRole('combobox');

    await userEvent.type(box, 'm');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    // A screen reader should not hear about the empty box either.
    expect(screen.queryByText(/stops match/)).not.toBeInTheDocument();
  });

  it('offers the matches and hands back the one that is picked', async () => {
    const onselect = vi.fn();
    render(StopSearch, { stops: network.stops, onselect });

    await userEvent.type(screen.getByRole('combobox'), 'mint');
    const options = screen.getAllByRole('option');
    // The name the query starts comes before the one that merely contains it.
    expect(options.map((option) => option.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Mint Lane Oldtown',
      'Old Mint Oldtown',
    ]);

    await userEvent.click(options[1]);
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(onselect.mock.calls[0][0].id).toBe('S3');
  });

  it('walks the list with the keyboard', async () => {
    const onselect = vi.fn();
    render(StopSearch, { stops: network.stops, onselect });

    const box = screen.getByRole('combobox');
    await userEvent.type(box, 'mint');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onselect.mock.calls[0][0].name).toBe('Old Mint');
    // Picking clears the box, so the next search starts from nothing.
    expect((box as HTMLInputElement).value).toBe('');
  });

  it('says so when nothing matches', async () => {
    render(StopSearch, { stops: network.stops, onselect: () => {} });
    await userEvent.type(screen.getByRole('combobox'), 'zzz');
    expect(screen.getByText(/No stop matches/)).toBeInTheDocument();
    expect(screen.getByText(/0 stops match/)).toBeInTheDocument();
  });
});
