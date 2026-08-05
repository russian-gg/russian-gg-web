import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // The admin panel is built from the learner product's tokens, so it needs the same
  // Tailwind pipeline rather than a stylesheet of its own.
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src-admin', import.meta.url)) },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:5080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist-admin',
    sourcemap: true,
    rollupOptions: {
      input: { admin: fileURLToPath(new URL('./admin.html', import.meta.url)) },
    },
  },
})
