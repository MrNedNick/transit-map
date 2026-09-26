import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Intro from './Intro.svelte';

describe('the first-visit explanation', () => {
  beforeEach(() => localStorage.clear());

  it('explains the map, offers examples and remembers being closed', async () => {
    const onexample = vi.fn();
    const first = render(Intro, { onexample });

    expect(screen.getByRole('heading', { name: 'How far can you get from a stop?' })).toBeInTheDocument();
    expect(screen.getByText(/invented city/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'What still runs at 3 a.m.?' }));
    expect(onexample).toHaveBeenCalledTimes(1);
    expect(onexample.mock.calls[0][0].patch).toMatchObject({ hour: 3, stopId: null });
    // An example shows the map, so the panel gets out of its way.
    expect(screen.queryByRole('heading', { name: /How far/ })).not.toBeInTheDocument();

    first.unmount();
    render(Intro, { onexample });
    expect(screen.queryByRole('heading', { name: /How far/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'What is this map?' }));
    expect(screen.getByRole('heading', { name: /How far/ })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(Intro, { onexample: () => {} });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('heading', { name: /How far/ })).not.toBeInTheDocument();
    expect(localStorage.getItem('transit-map:intro-seen')).toBe('1');
  });
});
