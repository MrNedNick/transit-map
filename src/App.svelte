<script lang="ts">
  import Header from './lib/components/Header.svelte';
  import Footer from './lib/components/Footer.svelte';
  import StopSearch from './lib/components/StopSearch.svelte';
  import SavedStops from './lib/components/SavedStops.svelte';
  import TransitMap from './lib/components/TransitMap.svelte';
  import { site } from './lib/site';
  import { feed } from './lib/state/network.svelte';
  import { savedStops } from './lib/state/saved.svelte';
  import { MODES, MODE_LABEL, type Mode, type Stop } from './lib/gtfs/types';

  feed.load();

  let selectedId = $state<string | null>(null);
  let modes = $state<Mode[]>([...MODES]);
  let view = $state({ lon: 12.5, lat: 49.0, zoom: 11.4 });
  let mapComponent = $state<ReturnType<typeof TransitMap> | null>(null);

  const stops = $derived(feed.network?.stops ?? []);
  const selected = $derived(selectedId ? (feed.network?.stopById.get(selectedId) ?? null) : null);

  function pick(stop: Stop) {
    selectedId = stop.id;
    mapComponent?.flyToStop(stop);
  }

  function toggleMode(mode: Mode) {
    modes = modes.includes(mode) ? modes.filter((m) => m !== mode) : [...modes, mode];
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
        {/if}

        <fieldset class="modes">
          <legend>Modes</legend>
          {#each MODES as mode (mode)}
            <label class="mode" data-mode={mode}>
              <input
                type="checkbox"
                checked={modes.includes(mode)}
                onchange={() => toggleMode(mode)}
              />
              <span>{MODE_LABEL[mode]}</span>
            </label>
          {/each}
        </fieldset>

        {#if selected}
          {@const stop = selected}
          <div class="stop-card">
            <h2>{stop.name}</h2>
            <p class="meta">{stop.district} · {stop.routeIds.length} routes</p>
            <button type="button" class="save" onclick={() => savedStops.toggle(stop)}>
              {savedStops.has(stop.id) ? 'Saved' : 'Save stop'}
            </button>
          </div>
        {/if}

        {#if feed.network}
          <SavedStops stopById={feed.network.stopById} onselect={pick} />
        {/if}
      </aside>

      <div class="canvas">
        {#if feed.error}
          <div class="overlay">
            <p>{feed.error}</p>
            <button type="button" onclick={() => feed.retry()}>Try again</button>
          </div>
        {:else if !feed.network}
          <div class="overlay"><p>Loading {site.city}…</p></div>
        {:else}
          <TransitMap
            bind:this={mapComponent}
            stops={feed.network.stops}
            {modes}
            {selectedId}
            {view}
            onselect={(id) => (selectedId = id)}
            onviewchange={(next) => (view = next)}
          />
        {/if}
      </div>
    </div>

    <dl class="counts">
      <div><dt>Stops</dt><dd>{stops.length.toLocaleString('en')}</dd></div>
      <div><dt>Routes</dt><dd>{feed.network?.routes.length ?? 0}</dd></div>
      <div>
        <dt>Stop times</dt>
        <dd>{feed.timetable ? feed.timetable.stopTimeCount.toLocaleString('en') : '…'}</dd>
      </div>
      <div>
        <dt>Feed parsed in</dt>
        <dd>{feed.timings.network + feed.timings.timetable} ms</dd>
      </div>
    </dl>
  </section>
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
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    height: min(72vh, 660px);
    min-height: 460px;
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

  .modes {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  legend {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    font-weight: 600;
    padding: 0;
    margin-bottom: 8px;
  }

  .mode {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 7px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 13px;
    cursor: pointer;
    background: var(--surface);
  }

  .mode:hover {
    border-color: var(--border-strong);
  }

  .mode input {
    accent-color: var(--accent);
    margin: 0;
  }

  .mode[data-mode='metro'] span {
    border-bottom: 2px solid var(--mode-metro);
  }
  .mode[data-mode='tram'] span {
    border-bottom: 2px solid var(--mode-tram);
  }
  .mode[data-mode='rail'] span {
    border-bottom: 2px solid var(--mode-rail);
  }
  .mode[data-mode='bus'] span {
    border-bottom: 2px solid var(--mode-bus);
  }

  .stop-card {
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
  }

  .stop-card h2 {
    font-size: 1rem;
  }

  .meta {
    color: var(--text-faint);
    font-size: 12.5px;
    margin-block: 2px 10px;
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
      min-height: 380px;
    }
  }
</style>
