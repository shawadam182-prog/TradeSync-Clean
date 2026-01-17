import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'apple-touch-icon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon.png'],
          manifest: {
            id: '/',
            name: 'TradeSync',
            short_name: 'TradeSync',
            description: 'Job management and accounting for UK tradespeople',
            theme_color: '#14b8a6',
            background_color: '#0f172a',
            display: 'standalone',
            orientation: 'portrait',
            scope: '/',
            start_url: '/',
            lang: 'en-GB',
            dir: 'ltr',
            categories: ['business', 'finance', 'productivity'],
            iarc_rating_id: '',
            prefer_related_applications: false,
            shortcuts: [
              {
                name: 'New Quote',
                short_name: 'Quote',
                description: 'Create a new quote',
                url: '/?action=new-quote',
                icons: [{ src: 'pwa-512x512.png', sizes: '2048x2048' }]
              },
              {
                name: 'New Job',
                short_name: 'Job',
                description: 'Create a new job',
                url: '/?action=new-job',
                icons: [{ src: 'pwa-512x512.png', sizes: '2048x2048' }]
              },
              {
                name: 'Add Expense',
                short_name: 'Expense',
                description: 'Add a new expense',
                url: '/?action=new-expense',
                icons: [{ src: 'pwa-512x512.png', sizes: '2048x2048' }]
              }
            ],
            icons: [
              {
                src: 'pwa-192x192.svg',
                sizes: 'any',
                type: 'image/svg+xml'
              },
              {
                src: 'pwa-512x512.svg',
                sizes: 'any',
                type: 'image/svg+xml'
              },
              {
                src: 'pwa-192x192.png',
                sizes: '2048x2048',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'pwa-512x512.png',
                sizes: '2048x2048',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'maskable-icon.png',
                sizes: '2048x2048',
                type: 'image/png',
                purpose: 'maskable'
              }
            ],
            screenshots: [
              {
                src: 'screenshot-1.jpeg',
                sizes: '945x2048',
                type: 'image/jpeg',
                form_factor: 'narrow',
                label: 'Home Dashboard'
              },
              {
                src: 'screenshot-2.jpeg',
                sizes: '945x2048',
                type: 'image/jpeg',
                form_factor: 'narrow',
                label: 'Quote Creator'
              },
              {
                src: 'screenshot-3.jpeg',
                sizes: '945x2048',
                type: 'image/jpeg',
                form_factor: 'narrow',
                label: 'Invoice View'
              },
              {
                src: 'screenshot-4.jpeg',
                sizes: '945x2048',
                type: 'image/jpeg',
                form_factor: 'narrow',
                label: 'Expense Tracking'
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB limit for large logo images
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            navigateFallback: 'index.html',
            navigateFallbackDenylist: [/^\/api/, /^\/functions/],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'tailwind-cache',
                  expiration: {
                    maxEntries: 5,
                    maxAgeSeconds: 60 * 60 * 24 * 30
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'cdnjs-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 30
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'supabase-api-cache',
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 60 * 60 * 24
                  },
                  networkTimeoutSeconds: 10,
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
