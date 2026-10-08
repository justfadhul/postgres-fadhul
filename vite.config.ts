import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import { VitePWA } from 'vite-plugin-pwa'

// Vercel serves the site from the domain root. Set BASE_PATH (for example
// /postgres-fadhul/) to host it under a sub-path such as a GitHub Pages project site.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  root: fileURLToPath(new URL('./app', import.meta.url)),
  publicDir: 'public',
  resolve: {
    alias: { '@content': fileURLToPath(new URL('./content', import.meta.url)) },
  },
  // PGlite ships its own WebAssembly and data files; pre-bundling breaks their URLs.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  worker: { format: 'es' },
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    target: ['es2022', 'safari16'],
  },
  plugins: [
    // Lessons are MDX, compiled at build time; a lesson with broken syntax fails the build.
    { enforce: 'pre', ...mdx({ jsxImportSource: 'react' }) },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Data Systems Mastery',
        short_name: 'DSM',
        description: 'Self-study course on databases and backend systems, with PostgreSQL in the page.',
        theme_color: '#0b5394',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // The app shell is precached. The PGlite engine (worker chunk, .wasm, .data
        // and extension bundles) is large, so it is cached at runtime on first use
        // instead of being downloaded for every visitor up front.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['**/pglite-worker-*.js', '**/*.wasm', '**/*.data', '**/*.tar.gz'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'dsm-engine',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 60 },
            },
          },
        ],
      },
    }),
  ],
})
