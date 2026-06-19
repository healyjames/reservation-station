import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  esbuild: {
    jsxImportSource: 'preact',
  },
  test: {
    environment: 'node',
    include: ['src/frontend/**/*.test.ts', 'src/frontend/**/*.test.tsx'],
    globals: true,
    css: true,
  },
  resolve: {
    alias: {
      '@frontend': resolve(__dirname, 'src/frontend'),
      '@shared': resolve(__dirname, 'src/frontend/shared'),
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
});
