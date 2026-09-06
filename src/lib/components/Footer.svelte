<script lang="ts">
  import { site } from '../site';
</script>

<footer class="footer">
  <div class="page inner">
    <p class="note">
      Timetables come from a GTFS feed committed to this repository; the basemap is a
      single PMTiles archive served next to it. No tile key, no API, no server.
    </p>
    <nav class="links" aria-label="Project">
      <a href={site.repo} rel="noreferrer noopener" target="_blank">GitHub</a>
      <a href={site.readme} rel="noreferrer noopener" target="_blank">README</a>
      <a href={site.demo} rel="noreferrer noopener" target="_blank">Live demo</a>
    </nav>
  </div>
</footer>

<style>
  .footer {
    border-top: 1px solid var(--border);
    background: var(--surface);
    margin-top: 56px;
  }

  .inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    padding-block: 22px 26px;
  }

  .note {
    font-size: 13px;
    color: var(--text-muted);
    max-width: 62ch;
  }

  .links {
    display: flex;
    gap: 18px;
    font-size: 13px;
  }

  @media (max-width: 700px) {
    .inner {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
