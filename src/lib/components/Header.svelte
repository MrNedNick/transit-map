<script lang="ts">
  import { site } from '../site';
  import ThemeToggle from './ThemeToggle.svelte';
</script>

<header class="header">
  <div class="page bar">
    <a class="brand" href="./" aria-label="{site.name}, home">
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--accent)" />
        <path
          d="M6 22 L13 9 L19 18 L26 11"
          fill="none"
          stroke="var(--on-accent)"
          stroke-width="2.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="13" cy="9" r="3" fill="var(--on-accent)" />
      </svg>
      <span class="brand-text">
        <strong>{site.name}</strong>
        <span class="brand-city">{site.city}</span>
      </span>
    </a>

    <nav class="actions" aria-label="Site">
      <a class="ghost" href={site.repo} rel="noreferrer noopener" target="_blank">
        Source
      </a>
      <ThemeToggle />
    </nav>
  </div>
</header>

<style>
  .header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
  }

  .bar {
    height: var(--header-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    text-decoration: none;
  }

  .brand-text {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .brand-text strong {
    font-size: 15px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .brand-city {
    font-size: 12px;
    color: var(--text-faint);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ghost {
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
  }

  .ghost:hover {
    color: var(--text);
    background: var(--surface-2);
  }

  @media (max-width: 480px) {
    .brand-city {
      display: none;
    }
  }
</style>
