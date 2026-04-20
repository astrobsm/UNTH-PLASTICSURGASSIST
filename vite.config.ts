import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Only include PWA plugin in production — it causes crashes and
    // service-worker caching issues during local development.
    mode === 'production' && VitePWA({
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
        'offline.html',
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

      // Development options — disabled to prevent SW caching conflicts with HMR
      devOptions: {
        enabled: false,
        type: 'module',
      },
    })
  ].filter(Boolean),
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // Build optimization for offline
  build: {
    sourcemap: false,
    // Use esbuild (default) for much faster minification (~10x faster than terser)
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React
          if (id.includes('react-dom')) return 'vendor-react';
          if (id.includes('react-router')) return 'vendor-react';
          if (id.includes('node_modules/react/')) return 'vendor-react';
          // UI libraries
          if (id.includes('lucide-react')) return 'vendor-ui';
          if (id.includes('react-hot-toast')) return 'vendor-ui';
          if (id.includes('@tanstack/react-query')) return 'vendor-ui';
          // Database
          if (id.includes('dexie')) return 'vendor-db';
          // Date utilities
          if (id.includes('date-fns')) return 'vendor-datefns';
          // PDF/Canvas (only needed for document generation)
          if (id.includes('html2canvas')) return 'vendor-pdf';
          if (id.includes('jspdf')) return 'vendor-pdf';
          // Heavy ML/OCR libs — isolated so they never block first load
          if (id.includes('@tensorflow')) return 'vendor-ml';
          if (id.includes('tesseract')) return 'vendor-ocr';
          // AI (only needed for AI features)
          if (id.includes('openai')) return 'vendor-ai';
          // Sanitization
          if (id.includes('dompurify')) return 'vendor-sanitize';
          // State management
          if (id.includes('zustand')) return 'vendor-state';
          // UUID
          if (id.includes('uuid')) return 'vendor-utils';
          // Drug database (large static data)
          if (id.includes('bnfDrugDatabase') || id.includes('drugInteractions')) return 'data-drugs';
        }
      }
    }
  }
}))