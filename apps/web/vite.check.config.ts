import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const clientSrc = '/Users/harryphan/Documents/dev/raycast-sui-cli/packages/client/src';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': clientSrc,
    },
  },
  server: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
});
