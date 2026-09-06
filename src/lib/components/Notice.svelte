<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    tone = 'quiet',
    title,
    children,
    action,
  }: {
    tone?: 'quiet' | 'problem';
    title?: string;
    children: Snippet;
    action?: Snippet;
  } = $props();
</script>

<div class="notice" class:problem={tone === 'problem'} role={tone === 'problem' ? 'alert' : undefined}>
  {#if title}<p class="title">{title}</p>{/if}
  <p class="body">{@render children()}</p>
  {#if action}
    <div class="action">{@render action()}</div>
  {/if}
</div>

<style>
  .notice {
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    padding: 14px;
    max-width: 42ch;
  }

  .notice.problem {
    border-style: solid;
    border-color: var(--danger);
    background: var(--danger-soft);
  }

  .title {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text);
  }

  .title + .body {
    margin-top: 5px;
  }

  .body {
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .action {
    margin-top: 11px;
  }
</style>
