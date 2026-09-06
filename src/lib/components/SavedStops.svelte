<script lang="ts">
  import { savedStops } from '../state/saved.svelte';
  import type { Stop } from '../gtfs/types';

  let {
    stopById,
    onselect,
  }: { stopById: Map<string, Stop>; onselect: (stop: Stop) => void } = $props();
</script>

<section class="saved" aria-labelledby="saved-heading">
  <div class="head">
    <h2 id="saved-heading">Saved stops</h2>
    {#if savedStops.count}
      <button type="button" class="clear" onclick={() => savedStops.clear()}>Clear all</button>
    {/if}
  </div>

  {#if savedStops.count === 0}
    <p class="empty">
      Nothing saved yet. Open a stop and press <strong>Save</strong> to keep it here — the list
      stays on this device between visits.
    </p>
  {:else}
    <ul>
      {#each savedStops.all as item (item.id)}
        <li>
          <button
            type="button"
            class="pick"
            onclick={() => {
              const stop = stopById.get(item.id);
              if (stop) onselect(stop);
            }}
          >
            {item.name}
          </button>
          <button
            type="button"
            class="remove"
            aria-label="Remove {item.name} from saved stops"
            onclick={() => savedStops.remove(item.id)}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    font-weight: 600;
  }

  .clear {
    border: 0;
    background: none;
    padding: 2px 4px;
    font-size: 12px;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
  }

  .clear:hover {
    color: var(--danger);
  }

  .empty {
    font-size: 13px;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
    padding: 12px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  li {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pick {
    flex: 1;
    min-width: 0;
    text-align: left;
    border: 0;
    background: none;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    font-size: 13.5px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pick:hover {
    background: var(--surface-2);
  }

  .remove {
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

  .remove:hover {
    color: var(--danger);
    background: var(--danger-soft);
  }
</style>
