<script lang="ts">
  import Header from './lib/components/Header.svelte';
  import Footer from './lib/components/Footer.svelte';
  import { site } from './lib/site';
</script>

<a class="skip" href="#main">Skip to content</a>

<Header />

<main id="main" tabindex="-1">
  <section class="intro page">
    <h1>Every stop in {site.city}, and how far you get from it.</h1>
    <p class="lede">
      Thousands of stops on one vector map, filtered by mode and time of day. Pick a
      stop to read its timetable and see the area you can reach before your coffee
      goes cold.
    </p>
  </section>
</main>

<Footer />

<style>
  .skip {
    position: absolute;
    left: -9999px;
    top: 0;
    z-index: 100;
    padding: 10px 14px;
    background: var(--accent);
    color: var(--on-accent);
    border-radius: 0 0 var(--radius-sm) 0;
    text-decoration: none;
  }

  .skip:focus {
    left: 0;
  }

  main:focus {
    outline: none;
  }

  .intro {
    padding-block: 44px 28px;
  }

  h1 {
    font-size: clamp(1.65rem, 1.1rem + 2.2vw, 2.5rem);
    max-width: 18ch;
  }

  .lede {
    margin-top: 14px;
    max-width: 62ch;
    font-size: clamp(0.95rem, 0.9rem + 0.3vw, 1.075rem);
    color: var(--text-muted);
  }
</style>
