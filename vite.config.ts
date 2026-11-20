import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: '::'
  },
  base: '/lab-ledger/',
  plugins: [
    tailwindcss(),
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Lab Ledger',
        short_name: 'Lab Ledger',
        description: 'Fast lab progress logging on Google Sheets',
        start_url: '/lab-ledger/',
        scope: '/lab-ledger/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallback: 'index.html' }
    })
  ],
  test: { include: ['tests/**/*.test.ts'] }
});
