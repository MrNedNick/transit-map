<script lang="ts">
  import Header from './lib/components/Header.svelte';
  import Footer from './lib/components/Footer.svelte';
  import StopSearch from './lib/components/StopSearch.svelte';
  import SavedStops from './lib/components/SavedStops.svelte';
  import Filters from './lib/components/Filters.svelte';
  import StopCard from './lib/components/StopCard.svelte';
  import Skeleton from './lib/components/Skeleton.svelte';
  import Notice from './lib/components/Notice.svelte';
  import HowItWorks from './lib/components/HowItWorks.svelte';
  import Features from './lib/components/Features.svelte';
  import TransitMap from './lib/components/TransitMap.svelte';
  import { site } from './lib/site';
  import { feed } from './lib/state/network.svelte';
  import { appState } from './lib/state/app.svelte';

  import { activeAt } from './lib/gtfs/active';
  import { stopDetails } from './lib/gtfs/stop-details';
  import { isochroneFrom } from './lib/routing/isochrone';
  import { DEFAULT_STATE, WEEKDAY_INDEX } from './lib/state/url';
  import type { Stop } from './lib/gtfs/types';

  feed.load();

  let mapComponent = $state<ReturnType<typeof TransitMap> | null>(null);

  const current = $derived(appState.value);

  const slice = $derived.by(() => {
    const network = feed.network;
    const timetable = feed.timetable;
    if (!network || !timetable) return null;
    return activeAt(network, timetable, {
      hour: current.hour,
      weekday: WEEKDAY_INDEX[current.day],
      modes: current.modes,
    });
  });

  // Until the timetable is in, everything is shown rather than nothing.
  const visibleStops = $derived.by(() => {
    const all = feed.network?.stops ?? [];
    const active = slice;
    if (!active) return all;
    return all.filter((stop) => active.stopIds.has(stop.id));
  });

  const selected = $derived(
    current.stopId ? (feed.network?.stopById.get(current.stopId) ?? null) : null,
  );

  const details = $derived.by(() => {
    const network = feed.network;
    const timetable = feed.timetable;
    const stop = selected;
    if (!network || !timetable || !stop) return null;
    return stopDetails(network, timetable, stop, {
      hour: current.hour,
      weekday: WEEKDAY_INDEX[current.day],
      activeRouteIds: new Set(slice?.routeIds ?? []),
    });
  });

  const isochrone = $derived.by(() => {
    const network = feed.network;
    const timetable = feed.timetable;
    const stop = selected;
    if (!network || !timetable || !stop) return null;
    return isochroneFrom(network, timetable, stop.id, {
      hour: current.hour,
      weekday: WEEKDAY_INDEX[current.day],
      modes: current.modes,
      minutes: current.minutes,
    });
  });

  /**
   * A link that names a stop but no camera — someone typed or trimmed it —
   * should still land on that stop rather than on the city centre.
   */
  let centredOnDeepLink = false;
  $effect(() => {
    if (centredOnDeepLink || !feed.network || !current.stopId) return;
    const atDefault =
      current.lon === DEFAULT_STATE.lon &&
      current.lat === DEFAULT_STATE.lat &&
      current.zoom === DEFAULT_STATE.zoom;
    centredOnDeepLink = true;
    if (!atDefault) return;
    const stop = feed.network.stopById.get(current.stopId);
    if (stop) mapComponent?.flyToStop(stop);
  });

  function pick(stop: Stop) {
    appState.update({ stopId: stop.id });
    mapComponent?.flyToStop(stop);
  }
</script>

<a class="skip" href="#main">Skip to content</a>

<Header />

<main id="main" tabindex="-1">
  <section class="intro page">
    <h1>Every stop in {site.city}, and how far you get from it.</h1>
    <p class="lede">
      Thousands of stops on one vector map, filtered by mode and time of day. Pick a
      stop to read its timetable and see the area you can reach before your coffee
      goes cold.
    </p>
  </section>

  <section class="app page" aria-label="Transit map">
    <div class="shell">
      <aside class="side">
        {#if feed.network}
          <StopSearch stops={feed.network.stops} onselect={pick} />
        {:else}
          <Skeleton height="36px" radius="var(--radius)" />
        {/if}

        <Filters
          modes={current.modes}
          hour={current.hour}
          day={current.day}
          onchange={(patch) => appState.update(patch)}
        />

        {#if feed.network && feed.error}
          <Notice tone="problem" title="The timetable did not load">
            {feed.error} The map still works, but times and reachable areas are missing.
            {#snippet action()}
              <button type="button" onclick={() => feed.retry()}>Try again</button>
            {/snippet}
          </Notice>
        {/if}

        {#if details}
          <StopCard
            {details}
            {isochrone}
            hour={current.hour}
            day={current.day}
            minutes={current.minutes}
            onminutes={(minutes) => appState.update({ minutes })}
            onclose={() => appState.update({ stopId: null })}
          />
        {:else if selected || !feed.network}
          <div class="card-skeleton">
            <Skeleton height="17px" width="62%" />
            <Skeleton height="12px" width="38%" />
            <Skeleton height="30px" radius="var(--radius)" />
            <Skeleton height="52px" radius="var(--radius)" />
          </div>
        {:else}
          <Notice title="Pick a stop to start">
            Click any dot on the map or search for a stop by name. You get the lines that
            call there, when the next ones leave, and the area you could reach from it.
          </Notice>
        {/if}

        {#if feed.network}
          <SavedStops stopById={feed.network.stopById} onselect={pick} />
        {/if}
      </aside>

      <div class="canvas">
        {#if !feed.network && feed.error}
          <div class="overlay">
            <Notice tone="problem" title="The map data did not load">
              {feed.error}
              {#snippet action()}
                <button type="button" onclick={() => feed.retry()}>Try again</button>
              {/snippet}
            </Notice>
          </div>
        {:else if !feed.network}
          <div class="overlay loading">
            <Skeleton height="100%" radius="0" />
            <p class="loading-label">Reading the {site.city} feed…</p>
          </div>
        {:else}
          <TransitMap
            bind:this={mapComponent}
            stops={visibleStops}
            modes={current.modes}
            activeRouteIds={slice?.routeIds ?? null}
            selectedId={current.stopId}
            isochrone={isochrone?.area ?? null}
            view={{ lon: current.lon, lat: current.lat, zoom: current.zoom }}
            onselect={(id) => appState.update({ stopId: id })}
            onviewchange={(camera) => appState.setCamera(camera)}
          />
        {/if}
      </div>
    </div>

    <dl class="counts">
      <div>
        <dt>Stops in service</dt>
        <dd>
          {#if feed.timetable}{visibleStops.length.toLocaleString('en')}{:else}<Skeleton
              width="4.5ch"
              height="1.1rem"
            />{/if}
        </dd>
      </div>
      <div>
        <dt>Routes running</dt>
        <dd>
          {#if slice}{slice.routeIds.length}{:else}<Skeleton width="3ch" height="1.1rem" />{/if}
        </dd>
      </div>
      <div>
        <dt>Stop times</dt>
        <dd>
          {#if feed.timetable}{feed.timetable.stopTimeCount.toLocaleString('en')}{:else}<Skeleton
              width="5ch"
              height="1.1rem"
            />{/if}
        </dd>
      </div>
      <div>
        <dt>Feed parsed in</dt>
        <dd>
          {#if feed.timetable}{feed.timings.network + feed.timings.timetable} ms{:else}<Skeleton
              width="5ch"
              height="1.1rem"
            />{/if}
        </dd>
      </div>
    </dl>
  </section>

  <HowItWorks />
  <Features />
</main>

<Footer />

<style>
  .skip {
    position: absolute;
    left: -9999px;
    top: 0;
    z-index: 100;
    padding: 10px 14px;
    background: var(--accent);
    color: var(--on-accent);
    border-radius: 0 0 var(--radius-sm) 0;
    text-decoration: none;
  }

  .skip:focus {
    left: 0;
  }

  main:focus {
    outline: none;
  }

  .intro {
    padding-block: 40px 24px;
  }

  h1 {
    font-size: clamp(1.65rem, 1.1rem + 2.2vw, 2.5rem);
    max-width: 18ch;
  }

  .lede {
    margin-top: 14px;
    max-width: 62ch;
    font-size: clamp(0.95rem, 0.9rem + 0.3vw, 1.075rem);
    color: var(--text-muted);
  }

  .shell {
    display: grid;
    grid-template-columns: 310px minmax(0, 1fr);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    height: min(74vh, 680px);
    min-height: 470px;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 16px;
    overflow-y: auto;
    border-right: 1px solid var(--border);
    background: var(--surface);
  }

  .canvas {
    position: relative;
    background: var(--surface-2);
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 12px;
    justify-items: center;
    color: var(--text-muted);
  }

  .overlay.loading {
    display: block;
    padding: 0;
  }

  .loading-label {
    position: absolute;
    inset-block-end: 14px;
    inset-inline-start: 14px;
    font-size: 12.5px;
    color: var(--text-muted);
  }

  .card-skeleton {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 13px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
  }

  button {
    border: 1px solid var(--border-strong);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
  }

  button:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 32px;
    margin: 18px 0 0;
  }

  .counts div {
    display: flex;
    flex-direction: column;
  }

  dt {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
  }

  dd {
    margin: 0;
    font-size: 1.1rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  @media (max-width: 860px) {
    .shell {
      grid-template-columns: 1fr;
      height: auto;
    }

    .side {
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }

    .canvas {
      height: 62vh;
      min-height: 400px;
    }
  }
</style>
