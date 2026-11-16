import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { cloudflareTest, type D1Migration } from '@cloudflare/vitest-pool-workers';
import { defineConfig, defineProject } from 'vitest/config';

// db/schema.sql is the canonical end-state schema (migrations/ only holds incremental ALTERs),
// so backend tests build their D1 database from it. Applied per test file by test/apply-schema.ts.
// Naive split on ';' after stripping '--' comments: fine for plain DDL. Revisit if schema.sql gains
// triggers (BEGIN ... END), block comments, or ';' / '--' inside string literals.
const schemaQueries = readFileSync(resolve(__dirname, 'db/schema.sql'), 'utf-8')
  .replace(/--.*$/gm, '')
  .split(';')
  .map((q) => q.trim())
  .filter(Boolean);
const testMigrations: D1Migration[] = [{ name: 'schema.sql', queries: schemaQueries }];

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
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: testMigrations,
                // Fake, test-only secrets so the suite does not depend on a developer's .env.
                JWT_SECRET: 'test-jwt-secret-not-for-production',
                SUPER_ADMIN_KEY: 'test-super-admin-key-not-for-production',
              },
            },
          }),
        ],
        test: {
          name: 'backend',
          include: ['test/**/*.spec.ts'],
          setupFiles: ['./test/apply-schema.ts'],
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
