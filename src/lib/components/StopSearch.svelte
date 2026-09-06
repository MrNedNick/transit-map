<script lang="ts">
  import { searchStops } from '../search';
  import type { Stop } from '../gtfs/types';
  import ModeDot from './ModeDot.svelte';

  let {
    stops,
    onselect,
  }: { stops: Stop[]; onselect: (stop: Stop) => void } = $props();

  let query = $state('');
  let active = $state(-1);
  let open = $state(false);

  const hits = $derived(searchStops(stops, query));

  function choose(stop: Stop) {
    onselect(stop);
    query = '';
    open = false;
    active = -1;
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!hits.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + hits.length) % hits.length;
      return;
    }
    if (event.key === 'Enter' && hits.length) {
      event.preventDefault();
      choose(hits[Math.max(0, active)].stop);
      return;
    }
    if (event.key === 'Escape') {
      open = false;
      active = -1;
    }
  }
</script>

<div class="search">
  <label class="visually-hidden" for="stop-search">Find a stop by name</label>
  <div class="field">
    <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" class="icon">
      <circle cx="9" cy="9" r="5.4" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="M13.2 13.2 17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
    <input
      id="stop-search"
      type="search"
      autocomplete="off"
      placeholder="Find a stop — try “Elmwood” or “Quay”"
      bind:value={query}
      oninput={() => {
        open = true;
        active = -1;
      }}
      onfocus={() => (open = true)}
      {onkeydown}
      role="combobox"
      aria-expanded={open && hits.length > 0}
      aria-controls="stop-search-results"
      aria-autocomplete="list"
    />
  </div>

  <p class="visually-hidden" aria-live="polite">
    {hits.length}
    {hits.length === 1 ? 'stop matches' : 'stops match'}
  </p>

  {#if open && query.trim().length >= 2}
    <ul class="results" id="stop-search-results" role="listbox" aria-label="Matching stops">
      {#each hits as hit, i (hit.stop.id)}
        <li>
          <button
            type="button"
            role="option"
            aria-selected={i === active}
            class:active={i === active}
            onclick={() => choose(hit.stop)}
            onmouseenter={() => (active = i)}
          >
            <span class="modes">
              {#each hit.stop.modes as mode (mode)}
                <ModeDot {mode} />
              {/each}
            </span>
            <span class="text">
              <strong>{hit.stop.name}</strong>
              <small>{hit.stop.district}</small>
            </span>
          </button>
        </li>
      {:else}
        <li class="none">No stop matches “{query.trim()}”.</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .field:focus-within {
    border-color: var(--focus);
  }

  .icon {
    color: var(--text-faint);
    flex: none;
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    padding: 9px 0;
    font: inherit;
    color: var(--text);
  }

  input:focus {
    outline: none;
  }

  input::-webkit-search-cancel-button {
    cursor: pointer;
  }

  .results {
    position: absolute;
    z-index: 15;
    inset-inline: 0;
    top: calc(100% + 6px);
    margin: 0;
    padding: 4px;
    list-style: none;
    max-height: 320px;
    overflow-y: auto;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
  }

  .results button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 9px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .results button.active {
    background: var(--surface-2);
  }

  .modes {
    display: flex;
    gap: 3px;
    flex: none;
    width: 34px;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .text strong {
    font-weight: 550;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .text small {
    color: var(--text-faint);
    font-size: 12px;
  }

  .none {
    padding: 10px;
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
