<script lang="ts">
  import Header from './lib/components/Header.svelte';
  import Footer from './lib/components/Footer.svelte';
  import StopSearch from './lib/components/StopSearch.svelte';
  import SavedStops from './lib/components/SavedStops.svelte';
  import { site } from './lib/site';
  import { feed } from './lib/state/network.svelte';
  import { savedStops } from './lib/state/saved.svelte';
  import type { Stop } from './lib/gtfs/types';

  feed.load();

  let selected = $state<Stop | null>(null);
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

  <section class="panel page">
    {#if feed.error}
      <p class="error">{feed.error}</p>
      <button type="button" onclick={() => feed.retry()}>Try again</button>
    {:else if !feed.network}
      <p class="status">Loading the feed…</p>
    {:else}
      <div class="grid">
        <div>
          <StopSearch stops={feed.network.stops} onselect={(stop) => (selected = stop)} />
          {#if selected}
            {@const stop = selected}
            <div class="card">
              <h2>{stop.name}</h2>
              <p class="meta">{stop.district} · {stop.id}</p>
              <button type="button" onclick={() => savedStops.toggle(stop)}>
                {savedStops.has(stop.id) ? 'Saved' : 'Save'}
              </button>
            </div>
          {/if}
        </div>
        <SavedStops
          stopById={feed.network.stopById}
          onselect={(stop) => (selected = stop)}
        />
      </div>

      <dl class="counts">
        <div><dt>Stops</dt><dd>{feed.network.stops.length.toLocaleString('en')}</dd></div>
        <div><dt>Routes</dt><dd>{feed.network.routes.length}</dd></div>
        <div>
          <dt>Stop times</dt>
          <dd>{feed.timetable ? feed.timetable.stopTimeCount.toLocaleString('en') : '…'}</dd>
        </div>
        <div>
          <dt>Parsed in</dt>
          <dd>{feed.timings.network + feed.timings.timetable} ms</dd>
        </div>
      </dl>
    {/if}
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
    padding-block: 44px 28px;
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

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 28px;
    align-items: start;
  }

  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .card {
    margin-top: 16px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .card h2 {
    font-size: 1.05rem;
  }

  .meta {
    color: var(--text-faint);
    font-size: 13px;
    margin-block: 2px 10px;
  }

  button {
    border: 1px solid var(--border-strong);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 6px 12px;
    cursor: pointer;
  }

  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 32px;
    margin: 28px 0 0;
    padding-top: 18px;
    border-top: 1px solid var(--border);
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
    font-size: 1.15rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .error {
    color: var(--danger);
    margin-bottom: 10px;
  }

  .status {
    color: var(--text-muted);
  }
</style>
