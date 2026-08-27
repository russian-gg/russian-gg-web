import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // Same-origin API in development, so the browser never deals with CORS or
      // cross-site cookie rules while iterating.
      '/api': { target: 'http://localhost:5081', changeOrigin: true },
      '/media': { target: 'http://localhost:5081', changeOrigin: true },
    },
  },
  build: {
    // Versioned immutable assets; the app shell is cheap to re-fetch, the chunks are not.
    assetsDir: 'assets',
    sourcemap: true,
  },
})
