<script lang="ts">
  import { examples, site, type Example } from '../site';
  import { openedWithView } from '../state/app.svelte';

  const STORAGE_KEY = 'transit-map:intro-seen';

  let { onexample }: { onexample: (example: Example) => void } = $props();

  function seenBefore(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  // Opens by itself once, on a first visit to the plain page.
  let open = $state(!openedWithView && !seenBefore());
  let panel = $state<HTMLElement | null>(null);
  let reopen = $state<HTMLButtonElement | null>(null);

  function close() {
    open = false;
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Storage blocked: the panel closes for this visit and may come back next time.
    }
    queueMicrotask(() => reopen?.focus());
  }

  function show() {
    open = true;
    queueMicrotask(() => panel?.focus());
  }

  function onkeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') close();
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <section
    bind:this={panel}
    class="intro-panel"
    aria-labelledby="intro-title"
    tabindex="-1"
  >
    <h2 id="intro-title">How far can you get from a stop?</h2>
    <p>
      {site.city} is an invented city with a real-format timetable. Pick any stop and the map
      shades everywhere you could reach in the time you choose — the ride, the wait and the
      walk included.
    </p>
    <p class="try">Try one:</p>
    <ul>
      {#each examples as example (example.label)}
        <li>
          <button
            type="button"
            class="example"
            onclick={() => {
              onexample(example);
              close();
            }}
          >
            {example.label}
          </button>
        </li>
      {/each}
    </ul>
    <button type="button" class="done" onclick={close}>Got it</button>
  </section>
{:else}
  <button
    bind:this={reopen}
    type="button"
    class="reopen"
    aria-label="What is this map?"
    title="What is this map?"
    onclick={show}
  >
    ?
  </button>
{/if}

<style>
  .intro-panel {
    position: absolute;
    z-index: 5;
    inset-block-start: 12px;
    inset-inline-start: 12px;
    width: min(340px, calc(100% - 24px));
    max-height: calc(100% - 24px);
    overflow-y: auto;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-md, var(--shadow-sm));
    font-size: 13.5px;
  }

  .intro-panel:focus {
    outline: none;
  }

  h2 {
    font-size: 1rem;
    margin: 0 0 6px;
  }

  p {
    margin: 0;
    color: var(--text-muted);
  }

  .try {
    margin-top: 12px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
  }

  ul {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  .example {
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--text);
  }

  .example:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .done {
    margin-top: 12px;
    padding: 7px 14px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }

  .reopen {
    position: absolute;
    z-index: 5;
    inset-block-start: 12px;
    inset-inline-start: 12px;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text);
    font-weight: 700;
    box-shadow: var(--shadow-sm);
  }

  .reopen:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  button:focus-visible,
  .intro-panel:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (max-width: 860px) {
    .intro-panel {
      max-height: 58%;
    }
  }
</style>
