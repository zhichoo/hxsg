import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Discourse Mini App (LINUX.DO MAPP) single-IIFE build config.
 * Produces dist-mapp/web/app.js + dist-mapp/web/app.css without copying public/
 * directly (package-mapp.mjs handles bundled vs CDN remote_assets packaging).
 */
export default defineConfig({
  publicDir: false,
  plugins: [react(), tailwindcss()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-mapp/web',
    emptyOutDir: true,
    target: 'es2022',
    minify: process.env.MINI_APP_DEBUG === '1' ? false : 'esbuild',
    sourcemap: process.env.MINI_APP_DEBUG === '1' ? 'inline' : false,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/main.tsx', import.meta.url)),
      name: 'HxsgMiniApp',
      formats: ['iife'],
      fileName: () => 'app.js',
      cssFileName: 'app',
    },
  },
});
