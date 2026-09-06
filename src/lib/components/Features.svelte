<script lang="ts">
  import { features } from '../site';
</script>

<section class="band page" aria-labelledby="inside-heading">
  <h2 id="inside-heading">What is behind it</h2>
  <p class="sub">
    The whole thing is a static site: a feed, a tile archive and the code that reads them.
  </p>

  <ul>
    {#each features as feature (feature.title)}
      <li>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d={feature.icon}
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <h3>{feature.title}</h3>
        <p>{feature.body}</p>
      </li>
    {/each}
  </ul>
</section>

<style>
  .band {
    padding-block: 56px;
    border-top: 1px solid var(--border);
  }

  h2 {
    font-size: clamp(1.25rem, 1.05rem + 0.9vw, 1.6rem);
  }

  .sub {
    margin-top: 8px;
    color: var(--text-muted);
    font-size: 0.95rem;
    max-width: 60ch;
  }

  ul {
    list-style: none;
    margin: 32px 0 0;
    padding: 0;
    display: grid;
    gap: 18px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  li {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 20px;
  }

  svg {
    color: var(--accent);
    display: block;
  }

  h3 {
    margin-top: 13px;
    font-size: 1rem;
  }

  li p {
    margin-top: 7px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--text-muted);
  }

  @media (max-width: 760px) {
    ul {
      grid-template-columns: 1fr;
    }
  }
</style>
