import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // The admin panel is built from the learner product's tokens, so it needs the same
  // Tailwind pipeline rather than a stylesheet of its own.
  plugins: [
    react(),
    tailwindcss(),
    {
      // In production nginx answers every unknown path with admin.html; the dev server would
      // answer a center's pay link (/pay/…) with the learner app's index.html instead.
      name: 'admin-pay-link-fallback',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url?.startsWith('/pay/')) request.url = '/admin.html'
          next()
        })
      },
    },
  ],
  // Its own dep cache: with the learner dev server on the default one, each re-optimizes the
  // other's chunks away and the open page loads two copies of React.
  cacheDir: 'node_modules/.vite-admin',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src-admin', import.meta.url)) },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:5081', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist-admin',
    /*
      The map is still written for local debugging, but no `sourceMappingURL` comment points
      at it — the panel was serving 1.2 MB of readable admin source to anyone who opened dev
      tools on admin.russian.gg.
    */
    sourcemap: 'hidden',
    rollupOptions: {
      input: { admin: fileURLToPath(new URL('./admin.html', import.meta.url)) },
    },
  },
})
