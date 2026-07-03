import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Standalone from vite.config.ts on purpose: the monkey() plugin must NOT run during
// tests. The '$' alias points GM_* imports at an in-memory stub so modules that touch
// Greasemonkey APIs can be imported under Node/jsdom.
export default defineConfig({
  resolve: {
    alias: {
      $: fileURLToPath(new URL('./test/mocks/gm.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
