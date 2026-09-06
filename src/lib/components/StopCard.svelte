<script lang="ts">
  import { formatTime } from '../gtfs/csv';
  import type { StopDetails } from '../gtfs/stop-details';
  import type { Isochrone } from '../routing/isochrone';
  import { MODE_LABEL } from '../gtfs/types';
  import { savedStops } from '../state/saved.svelte';
  import { DAY_LABEL, DAY_PHRASE, type DayType } from '../state/url';
  import Notice from './Notice.svelte';
  import RouteBadge from './RouteBadge.svelte';

  let {
    details,
    isochrone,
    hour,
    day,
    minutes,
    onminutes,
    onclose,
  }: {
    details: StopDetails;
    isochrone: Isochrone | null;
    hour: number;
    day: DayType;
    minutes: number;
    onminutes: (minutes: number) => void;
    onclose: () => void;
  } = $props();

  const stop = $derived(details.stop);
  const saved = $derived(savedStops.has(stop.id));
  const clock = $derived(`${String(hour).padStart(2, '0')}:00`);

  function headway(seconds: number | null): string | null {
    if (!seconds) return null;
    const mins = Math.round(seconds / 60);
    return `every ${mins} min`;
  }
</script>

<article class="card" aria-labelledby="stop-card-title">
  <header>
    <div>
      <h2 id="stop-card-title">{stop.name}</h2>
      <p class="meta">{stop.district} · {stop.id}</p>
    </div>
    <button type="button" class="close" aria-label="Close stop details" onclick={onclose}>
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      </svg>
    </button>
  </header>

  <div class="actions">
    <button type="button" class="save" class:on={saved} onclick={() => savedStops.toggle(stop)}>
      {saved ? 'Saved' : 'Save stop'}
    </button>
    <label class="budget" for="travel-budget">
      <span>Reachable in</span>
      <select
        id="travel-budget"
        value={minutes}
        onchange={(e) => onminutes(Number(e.currentTarget.value))}
      >
        {#each [10, 15, 20, 30, 45] as value (value)}
          <option {value}>{value} min</option>
        {/each}
      </select>
    </label>
  </div>

  <section class="reach" aria-labelledby="stop-reach">
    <h3 id="stop-reach">Where {minutes} minutes gets you</h3>
    {#if isochrone && isochrone.stopsReached > 1}
      <p class="figures">
        <strong>{isochrone.stopsReached.toLocaleString('en')}</strong> stops ·
        <strong>{isochrone.squareKm.toFixed(1)} km²</strong> shaded on the map
        <small>computed in {Math.round(isochrone.millis)} ms</small>
      </p>
    {:else}
      <Notice>
        Nothing runs from here at {clock} on {DAY_PHRASE[day]}, so there is no area to
        shade. The walk is all you get.
      </Notice>
    {/if}
  </section>

  <section aria-labelledby="stop-routes">
    <h3 id="stop-routes">Lines calling here</h3>
    {#if details.routes.length}
      <ul class="routes">
        {#each details.routes as route (route.routeId)}
          <li class:off={!route.running}>
            <RouteBadge
              shortName={route.shortName}
              colour={route.colour}
              mode={route.mode}
              dim={!route.running}
            />
            <span class="towards">
              <span class="to">to {route.headsigns.join(' / ')}</span>
              <small>{MODE_LABEL[route.mode]}{route.running ? '' : ' · not running now'}</small>
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <Notice>No line calls at this stop in the feed.</Notice>
    {/if}
  </section>

  <section aria-labelledby="stop-departures">
    <h3 id="stop-departures">Next departures after {clock}, {DAY_LABEL[day]}</h3>
    {#if details.departures.length}
      <ul class="departures">
        {#each details.departures as departure (departure.tripId + departure.time)}
          <li>
            <time datetime={formatTime(departure.time)}>
              {departure.approximate ? '~' : ''}{formatTime(departure.time)}
            </time>
            <RouteBadge
              shortName={departure.shortName}
              colour={departure.colour}
              mode={departure.mode}
            />
            <span class="headsign">{departure.headsign}</span>
            {#if headway(departure.headway)}
              <span class="freq">{headway(departure.headway)}</span>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="footnote">
        A tilde marks service the feed describes as a headway rather than a printed
        time — the vehicle comes about then, not exactly then.
      </p>
    {:else if details.neverServed}
      <Notice>
        This stop is in the feed, but no trip calls at it. There is no timetable to show.
      </Notice>
    {:else}
      <Notice>
        Nothing leaves this stop after {clock} on {DAY_PHRASE[day]}. Try another hour
        or another kind of day.
      </Notice>
    {/if}
  </section>
</article>

<style>
  .card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    padding: 13px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  h2 {
    font-size: 1.02rem;
    line-height: 1.25;
  }

  .meta {
    color: var(--text-faint);
    font-size: 12px;
    margin-top: 2px;
  }

  .close {
    flex: none;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    background: none;
    border-radius: var(--radius-sm);
    color: var(--text-faint);
    cursor: pointer;
  }

  .close:hover {
    color: var(--text);
    background: var(--surface);
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .save {
    border: 1px solid var(--border-strong);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 5px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .save:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .save.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    font-weight: 600;
  }

  .budget {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--text-muted);
  }

  select {
    font: inherit;
    font-size: 12.5px;
    padding: 4px 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
  }

  .figures {
    font-size: 13px;
    color: var(--text-muted);
  }

  .figures strong {
    color: var(--text);
  }

  .figures small {
    display: block;
    font-size: 11.5px;
    color: var(--text-faint);
    margin-top: 2px;
  }

  h3 {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    font-weight: 600;
    margin-bottom: 7px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .routes li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .routes li.off .towards {
    color: var(--text-faint);
  }

  .towards {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: 13px;
    line-height: 1.35;
  }

  .to {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .towards small {
    color: var(--text-faint);
    font-size: 11.5px;
  }

  .departures li {
    display: grid;
    grid-template-columns: 52px auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  time {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .headsign {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .freq {
    grid-column: 2 / -1;
    font-size: 11.5px;
    color: var(--text-faint);
    margin-top: -4px;
  }

  .footnote {
    margin-top: 8px;
    font-size: 11.5px;
    color: var(--text-faint);
  }
</style>
