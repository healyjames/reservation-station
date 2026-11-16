import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Builds the test D1 database from db/schema.sql (see vitest.config.mts).
// applyD1Migrations records what it applied, so re-running in the same storage is a no-op.
// Relies on per-test-file storage isolation; within a file, specs reset rows in beforeEach.
await applyD1Migrations(env.maximum_bookings_db, env.TEST_MIGRATIONS);
