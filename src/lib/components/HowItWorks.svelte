<script lang="ts">
  import { steps } from '../site';
</script>

<section class="band page" aria-labelledby="how-heading">
  <h2 id="how-heading">Three moves</h2>
  <p class="sub">Everything on this page is one of these, or a consequence of one.</p>

  <ol>
    {#each steps as step, index (step.title)}
      <li>
        <span class="number" aria-hidden="true">{index + 1}</span>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
      </li>
    {/each}
  </ol>
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

  ol {
    list-style: none;
    margin: 32px 0 0;
    padding: 0;
    display: grid;
    gap: 26px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .number {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 13px;
    font-weight: 700;
  }

  h3 {
    margin-top: 14px;
    font-size: 1rem;
  }

  li p {
    margin-top: 7px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--text-muted);
  }

  @media (max-width: 760px) {
    ol {
      grid-template-columns: 1fr;
      gap: 22px;
    }
  }
</style>
