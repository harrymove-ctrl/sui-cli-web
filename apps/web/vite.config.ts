import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  define: {
    // react-draggable (pulled in by react-grid-layout) reads
    // `process.env.DRAGGABLE_DEBUG` inside a log() it calls on EVERY drag/resize
    // event. Vite's dev server does not define `process`, so without this the
    // reference throws "process is not defined", the drag handler crashes, and
    // cards silently refuse to move. `vite build` already inlines it, so this
    // only matters for the dev server.
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        // Matches sui-cli-web-server's default PORT (apps/server/src/index.ts) -
        // keep in sync with however the server is actually started.
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Enable code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Sui SDK - large library, separate chunk
          if (id.includes('@mysten/sui') || id.includes('@mysten/bcs')) {
            return 'vendor-sui';
          }
          // Core React libraries
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/')
          ) {
            return 'vendor-react';
          }
          // UI libraries
          if (
            id.includes('framer-motion') ||
            id.includes('lucide-react') ||
            id.includes('react-hot-toast')
          ) {
            return 'vendor-ui';
          }
          // Radix UI components
          if (id.includes('@radix-ui/react-')) {
            return 'vendor-radix';
          }
          // WebGL background
          if (id.includes('ogl')) {
            return 'background';
          }
          // State management
          if (id.includes('zustand')) {
            return 'vendor-state';
          }
          // Lenis smooth scroll
          if (id.includes('lenis')) {
            return 'lenis';
          }
        },
      },
    },
    // Improve chunk size warnings
    chunkSizeWarningLimit: 500,
    // Enable minification (using esbuild for speed, no extra deps)
    minify: 'esbuild',
    // Generate source maps for debugging (optional)
    sourcemap: false,
  },
  // Optimize dependencies
  optimizeDeps: {
    // Pre-bundle the grid libs so the `define` above is applied to their code
    // (react-draggable's process.env access lives inside react-grid-layout's tree).
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'react-grid-layout',
      'react-draggable',
    ],
    // Exclude libraries with __DEFINES__ issues in dev mode
    exclude: [
      '@microsoft/clarity',
      '@statsig/js-client',
      '@statsig/session-replay',
      '@statsig/web-analytics',
    ],
  },
});
