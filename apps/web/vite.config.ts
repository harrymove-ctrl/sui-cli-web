import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        // Backend runs on 4001 in this environment (3001 is occupied by an
        // unrelated process on this machine) - keep in sync with however the
        // server is actually started (see packages/server's PORT env var).
        target: 'http://localhost:4001',
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
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react';
          }
          // UI libraries
          if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('react-hot-toast')) {
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
    include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
    // Exclude libraries with __DEFINES__ issues in dev mode
    exclude: ['@microsoft/clarity', '@statsig/js-client', '@statsig/session-replay', '@statsig/web-analytics'],
  },
});
