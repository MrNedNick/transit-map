<script lang="ts">
  import type { Mode } from '../gtfs/types';

  let {
    shortName,
    colour,
    mode,
    dim = false,
  }: { shortName: string; colour: string; mode: Mode; dim?: boolean } = $props();
</script>

<span class="badge" class:dim style="--badge: {colour}" data-mode={mode}>{shortName}</span>

<style>
  .badge {
    display: inline-grid;
    place-items: center;
    min-width: 30px;
    padding: 1px 7px;
    border-radius: 5px;
    background: var(--badge);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    /* Route colours come from the feed, so the label gets a shadow rather than
       a guess at whether this particular hex is light or dark. */
    text-shadow: 0 1px 1px rgb(0 0 0 / 35%);
  }

  .badge.dim {
    opacity: 0.45;
  }
</style>
