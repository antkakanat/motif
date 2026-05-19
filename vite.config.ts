import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  esbuild: {
    logOverride: { 'duplicate-object-key': 'silent' }
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      devOptions: {
        enabled: true
      },
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico', 
        'favicon-16x16.png', 
        'favicon-32x32.png', 
        'apple-touch-icon.png', 
        'logo-light.png', 
        'logo-dark.png', 
        'screenshots/desktop.png', 
        'screenshots/mobile.png',
        'offline.html'
      ],
      manifest: {
        name: 'Motif — Capture every note.',
        short_name: 'Motif',
        description: 'No cloud. No subscription. No noise. Just your links, quotes, notes, and images — private, offline, and always yours.',
        theme_color: '#5B4ED6',
        background_color: '#0F0E1A',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        screenshots: [
          {
            src: 'screenshots/desktop.png',
            sizes: '1200x630',
            type: 'image/png',
            form_factor: 'wide'
          },
          {
            src: 'screenshots/mobile.png',
            sizes: '1200x630',
            type: 'image/png'
          }
        ],
        share_target: {
          action: '/',
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url'
          }
        }
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'motif-fonts',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});
