import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig, defineProject } from 'vitest/config';

const frontendAliases = {
  '@frontend': resolve(__dirname, 'src/frontend'),
  '@shared': resolve(__dirname, 'src/frontend/shared'),
  '@constants': resolve(__dirname, 'src/constants'),
  react: 'preact/compat',
  'react-dom': 'preact/compat',
};

export default defineConfig({
  test: {
    projects: [
      defineProject({
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
          }),
        ],
        test: {
          name: 'backend',
          include: ['test/**/*.spec.ts'],
        },
      }),
      defineProject({
        plugins: [preact()],
        resolve: {
          alias: frontendAliases,
        },
        esbuild: {
          jsxImportSource: 'preact',
        },
        test: {
          name: 'frontend',
          include: ['src/frontend/**/*.test.ts', 'src/frontend/**/*.test.tsx'],
          environment: 'node',
          globals: true,
          css: true,
        },
      }),
    ],
  },
});
