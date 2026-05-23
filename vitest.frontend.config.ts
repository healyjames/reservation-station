import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/frontend/**/*.test.ts', 'src/frontend/**/*.test.tsx'],
    globals: true,
  },
  resolve: {
    alias: {
      '@frontend': resolve(__dirname, 'src/frontend'),
      '@shared': resolve(__dirname, 'src/frontend/shared'),
    },
  },
});
