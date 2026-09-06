import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

// `base` matters for GitHub Pages, where the site is served from /<repo>/.
// Set BASE_PATH=/transit-map/ in the deploy workflow; locally it stays '/'.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  // `svelteTesting` points the resolver at the browser build of Svelte, which
  // is what a component test needs in order to mount anything at all.
  plugins: [svelte(), svelteTesting()],
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
