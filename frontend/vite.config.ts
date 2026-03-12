import { defineConfig, loadEnv } from 'vite'
import fs from 'fs'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')
  console.log('Loaded environment variables:', env)
  
  const useHttps = env.VITE_DEV_HTTPS === 'true'
  const httpsOptions = useHttps && env.VITE_DEV_HTTPS_KEY && env.VITE_DEV_HTTPS_CERT
    ? {
        key: fs.readFileSync(env.VITE_DEV_HTTPS_KEY),
        cert: fs.readFileSync(env.VITE_DEV_HTTPS_CERT),
      }
    : undefined

  return {
    plugins: [react()],
    server: {
      host: true, // bind to 0.0.0.0 so other devices on the LAN can access
      port: Number(env.FRONTEND_PORT) || 3000, // Default to 3000 if not set
      strictPort: true,
      https: httpsOptions,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
      hmr: {
        overlay: false,
      },
    },
    define: {
      'process.env': env,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth'],
            'vendor-firestore': ['firebase/firestore', 'firebase/storage'],
            'vendor-charts': ['recharts'],
            'vendor-icons': ['react-icons'],
            'vendor-cloudinary': ['@cloudinary/react', '@cloudinary/url-gen'],
            'vendor-toast': ['react-toastify'],
            'vendor-motion': ['framer-motion'],
            'vendor-utils': ['axios', 'date-fns', 'yup', 'zustand', 'react-hook-form'],
          },
        },
      },
      chunkSizeWarningLimit: 350,
      target: 'esnext',
      cssMinify: true,
    },
  };
});
