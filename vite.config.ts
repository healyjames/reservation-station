import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

const PAGE_DIRS = ['admin', 'booking', 'booking-widget', 'cancel'];

/**
 * Dev server only: without a trailing slash, Vite's SPA fallback serves the root page (the booking widget) for /admin,
 * /booking, etc. Redirect them to the slashed URL so each opens its own index.html, keeping the query and hash.
 */
const trailingSlashRedirect = (): Plugin => ({
  name: 'page-trailing-slash-redirect',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const [path, query = ''] = (req.url ?? '').split('?');
      if (!PAGE_DIRS.includes(path.slice(1))) return next();
      res.statusCode = 301;
      res.setHeader('Location', `${path}/${query ? `?${query}` : ''}`);
      res.end();
    });
  },
});

export default defineConfig({
  root: resolve(__dirname, 'src/frontend'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [trailingSlashRedirect(), preact(), tailwindcss()],

  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/frontend/index.html'),
        'booking-widget': resolve(__dirname, 'src/frontend/booking-widget/index.html'),
        booking: resolve(__dirname, 'src/frontend/booking/index.html'),
        admin: resolve(__dirname, 'src/frontend/admin/index.html'),
        cancel: resolve(__dirname, 'src/frontend/cancel/index.html'),
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
      '@constants': resolve(__dirname, 'src/constants'),
    },
  },
});
