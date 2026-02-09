import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use injectManifest so we fully control the SW (src/sw.ts)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',   // We handle update prompt in-app
      injectRegister: false,    // We register manually in main.tsx

      includeAssets: [
        'favicon.png',
        'apple-touch-icon.png',
        'logo.png',
        'icon-192.png',
        'icon-512.png',
      ],

      manifest: {
        name: 'Plastic Surgeon Assistant',
        short_name: 'PS Assistant',
        description: 'Clinical assistant for plastic surgery workflows - Works fully offline!',
        theme_color: '#0E9F6E',
        background_color: '#F9FAFB',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        categories: ['medical', 'health', 'education'],
        icons: [
          {
            src: 'logo.png',
            sizes: 'any',
            type: 'image/png',
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Patient List',
            short_name: 'Patients',
            description: 'View patient list',
            url: '/patients',
            icons: [{ src: '/logo.png', sizes: '96x96' }],
          },
          {
            name: 'Admissions',
            short_name: 'Admit',
            description: 'Admission & discharge',
            url: '/admission-discharge',
            icons: [{ src: '/logo.png', sizes: '96x96' }],
          },
          {
            name: 'Ward Rounds',
            short_name: 'Rounds',
            description: 'Ward rounds',
            url: '/ward-rounds',
            icons: [{ src: '/logo.png', sizes: '96x96' }],
          },
          {
            name: 'MCQ Assessment',
            short_name: 'MCQ',
            description: 'Take MCQ test',
            url: '/mcq-education',
            icons: [{ src: '/logo.png', sizes: '96x96' }],
          },
        ],
      },

      // InjectManifest Workbox config
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },

      // Development options
      devOptions: {
        enabled: true,
        type: 'module',
      },
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
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@tanstack/react-query', 'react-hot-toast', 'lucide-react'],
          db: ['dexie']
        }
      }
    }
  }
})