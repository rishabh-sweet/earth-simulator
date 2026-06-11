import { defineConfig } from 'vite';
import { resolve } from 'path';

// Preview-only config — does not affect the production simulator build.
// Run: npm run dev:landing
export default defineConfig({
  root: resolve(__dirname),
  build: {
    outDir: resolve(__dirname, 'dist-landing'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'landing/index.html'),
    },
  },
  server: {
    open: '/landing/',
  },
});
