import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode from current directory (frontend/)
  const env = loadEnv(mode, process.cwd(), '')

  // HTTPS configuration
  const enableHttps = env.VITE_ENABLE_HTTPS === 'true'
  let httpsConfig = undefined

  if (enableHttps) {
    try {
      const certFile = resolve('../', env.VITE_SSL_CERT_FILE || 'ssl/cert.pem')
      const keyFile = resolve('../', env.VITE_SSL_KEY_FILE || 'ssl/key.pem')

      httpsConfig = {
        cert: readFileSync(certFile),
        key: readFileSync(keyFile)
      }

      console.log('🔒 Vite HTTPS enabled')
      console.log('📜 SSL Certificate:', certFile)
      console.log('🔑 SSL Key:', keyFile)
    } catch (error) {
      console.error('Failed to load SSL certificates for Vite, falling back to HTTP:', error.message)
      httpsConfig = undefined
    }
  }

  // Backend proxy target
  const backendUrl = env.VITE_API_BASE_URL || 'http://localhost:23000'
  const backendTarget = backendUrl

  return {
    plugins: [react()],
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
      port: parseInt(env.FRONTEND_PORT || env.VITE_PORT || '5174'),
      https: httpsConfig,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false // Allow self-signed certificates
        }
      }
    }
  }
})
