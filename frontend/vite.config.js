import { webcrypto } from 'node:crypto'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

// Node 18 has no global `crypto`; workbox-build (via vite-plugin-pwa) needs it
// to generate the service worker. Node 20+ provides it and this is a no-op.
// Preferred over a --experimental-global-webcrypto flag in the build script,
// which is already inert on Node 20 and removed in later versions.
globalThis.crypto ??= webcrypto

export default defineConfig({
  // Relative base so dist/index.html works when opened from file://
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      // The whole app is one HTML file; precache it and the icons.
      workbox: { globPatterns: ['**/*.{html,png,svg,ico}'] },
      manifest: {
        name: 'Schengen Tracker',
        short_name: 'Schengen',
        description: 'Offline 90/180-day Schengen compliance tracker',
        theme_color: '#0A0C10',
        background_color: '#0A0C10',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
    // MUST be last: it inlines every emitted JS/CSS asset into index.html.
    viteSingleFile(),
  ],
  build: {
    // Required by vite-plugin-singlefile: one chunk, no code splitting.
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
})
