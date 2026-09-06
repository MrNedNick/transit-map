# Transit Map

A city transit map in the browser: thousands of stops with clustering, filters by
mode and time of day, stop timetables and “where can I get in 15 minutes”
isochrones — served from static files, with no map key and no backend.

Built with Svelte 5 (runes), MapLibre GL, PMTiles and TypeScript.

## Getting started

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build locally |
| `npm run check` | Svelte + TypeScript diagnostics |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Deploy

The site is static, so it deploys as files. `.github/workflows/deploy.yml`
lints, type-checks, tests, builds and publishes to GitHub Pages on every push
to `main`; the demo is at <https://mrnednick.github.io/transit-map/>.

A project page is served from a subdirectory, so the build needs to know it:

```bash
BASE_PATH=/transit-map/ npm run build
```

Anywhere else — Netlify, Vercel, an S3 bucket, a folder behind nginx — takes
`npm run build` and the `dist/` folder as they are, with no environment
variable and nothing to configure. The GTFS feed and the PMTiles basemap are
committed to the repository and shipped as part of the build.

A full write-up lives at the end of this file once the app is feature complete.
