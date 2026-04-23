import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/console/',
  build: {
    rollupOptions: {
      output: {
        // Add timestamp to filenames to bust cache
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`
      }
    }
  },
  server: {
    port: 23001,
    proxy: {
      '/api': {
        target: 'http://localhost:23000',
        changeOrigin: true
      }
    }
  }
})
