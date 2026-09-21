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
    /*
      Hidden rather than off: Rollup still writes the `.map` files, so a stack trace from
      production can be resolved locally or uploaded to an error reporter, but no
      `//# sourceMappingURL=` comment is emitted — so a browser never fetches one. The learner
      bundle's map is 3.1 MB, which is three times the bundle.
    */
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        /*
          React and the router change on their own schedule, which is to say rarely. Splitting
          them out means a deploy that touches only product code leaves this chunk's hash
          alone, and a returning learner re-downloads the part that changed instead of the
          whole application.
        */
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
