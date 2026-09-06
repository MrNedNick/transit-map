<script lang="ts">
  import type { Mode } from '../gtfs/types';

  let { mode, label = '' }: { mode: Mode; label?: string } = $props();
</script>

<span class="dot" data-mode={mode} title={label} aria-hidden={label ? undefined : 'true'}></span>

<style>
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
    display: inline-block;
  }

  .dot[data-mode='tram'] {
    background: var(--mode-tram);
  }
  .dot[data-mode='metro'] {
    background: var(--mode-metro);
  }
  .dot[data-mode='rail'] {
    background: var(--mode-rail);
  }
  .dot[data-mode='bus'] {
    background: var(--mode-bus);
  }
</style>
