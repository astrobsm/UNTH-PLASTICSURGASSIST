import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.png', 
        'apple-touch-icon.png', 
        'logo.png', 
        'icon-192.png', 
        'icon-512.png',
        'sw.js'
      ],
      manifest: {
        name: 'Plastic Surgeon Assistant',
        short_name: 'PSA',
        description: 'Clinical assistant for plastic surgery workflows - Works fully offline!',
        theme_color: '#0E9F6E',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'logo.png',
            sizes: 'any',
            type: 'image/png'
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Precache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
        // Maximum file size to precache (5MB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Navigation fallback for SPA
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/sw\.js$/],
        // Clean old caches on activation
        cleanupOutdatedCaches: true,
        // Skip waiting for new service worker
        skipWaiting: true,
        // Claim clients immediately
        clientsClaim: true,
        // Runtime caching strategies
        runtimeCaching: [
          // API GET requests - Network First with cache fallback
          {
            urlPattern: /^(https?:\/\/[^\/]+)?\/api\/.*$/i,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-cache-v3',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Images - Cache First
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache-v3',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 24 * 60 * 60 // 60 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Fonts - Cache First (long-term cache)
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache-v3',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Google Fonts stylesheets - Stale While Revalidate
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          // Google Fonts files - Cache First
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      // Development options
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // Build optimization for offline
  build: {
    // Generate source maps for debugging
    sourcemap: false,
    // Minimize code
    minify: 'terser',
    // Rollup options
    rollupOptions: {
      output: {
        // Chunk splitting for better caching
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@tanstack/react-query', 'react-hot-toast', 'lucide-react'],
          db: ['dexie']
        }
      }
    }
  }
})