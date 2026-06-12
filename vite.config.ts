import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname, 'src/frontend'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [preact()],

  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/frontend/index.html'),
        'booking-widget': resolve(__dirname, 'src/frontend/booking-widget/index.html'),
        'booking': resolve(__dirname, 'src/frontend/booking/index.html'),
        'admin': resolve(__dirname, 'src/frontend/admin/index.html'),
        'cancel': resolve(__dirname, 'src/frontend/cancel/index.html'),
      },
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },

  resolve: {
    alias: {
      '@frontend': resolve(__dirname, 'src/frontend'),
      '@shared': resolve(__dirname, 'src/frontend/shared'),
    },
  },
})
