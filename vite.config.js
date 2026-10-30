import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // Resolve `@/...` to the absolute path of ./src. Must be absolute,
      // otherwise Vite warns about duplicated modules for the same file.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react()],
  server: {
    port: 5173,
    // Optional: forward /api to the local Express backend during development.
    // Enable by setting VITE_API_BASE_URL=/api and running the backend on 5000.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
