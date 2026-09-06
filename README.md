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

A full write-up lives at the end of this file once the app is feature complete.
