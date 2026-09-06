<script lang="ts">
  let {
    width = '100%',
    height = '1em',
    radius = 'var(--radius-sm)',
  }: { width?: string; height?: string; radius?: string } = $props();
</script>

<span
  class="skeleton"
  aria-hidden="true"
  style="--w: {width}; --h: {height}; --r: {radius}"
></span>

<style>
  .skeleton {
    display: block;
    width: var(--w);
    height: var(--h);
    border-radius: var(--r);
    background: linear-gradient(
      90deg,
      var(--surface-2) 25%,
      var(--border) 50%,
      var(--surface-2) 75%
    );
    background-size: 280% 100%;
    animation: sweep 1.5s linear infinite;
  }

  @keyframes sweep {
    from {
      background-position: 140% 0;
    }
    to {
      background-position: -140% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
      background: var(--surface-2);
    }
  }
</style>
