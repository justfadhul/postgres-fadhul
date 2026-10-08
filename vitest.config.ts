import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@content': fileURLToPath(new URL('./content', import.meta.url)) },
  },
  test: {
    include: ['app/src/**/*.test.ts', 'tests/**/*.test.ts', 'content/**/*.test.ts'],
    environment: 'node',
    // Each PGlite boot takes a few seconds in Node; spike tests seed real data.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
})
