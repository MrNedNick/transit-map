<script lang="ts">
  import { theme } from '../theme.svelte';

  const dark = $derived(theme.value === 'dark');
</script>

<button
  type="button"
  class="toggle"
  aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
  aria-pressed={dark}
  onclick={() => theme.toggle()}
>
  {#if dark}
    <svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2" />
        <path d="M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
      </g>
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17">
      <path
        d="M20 14.4A8.4 8.4 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4Z"
        fill="currentColor"
      />
    </svg>
  {/if}
</button>

<style>
  .toggle {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text-muted);
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s,
      background 0.15s;
  }

  .toggle:hover {
    color: var(--text);
    border-color: var(--border-strong);
    background: var(--surface-2);
  }
</style>
