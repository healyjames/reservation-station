# Sean - History

## Core Context

Backend Dev on the Maximum Bookings project. Owns the Hono API, D1 database schema, Cloudflare Workers configuration.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph

## Key File Paths

- `src/` - Worker source
- `wrangler.jsonc` - config
- `worker-configuration.d.ts` - generated bindings (run `wrangler types`)
- `migrations/` - D1 SQL migrations

## Learnings

- **README API reference**: Replaced the brief `### Tenant API` bullet list with a full `## API Reference` section covering all 12 endpoints across tenants and reservations. Key accuracy points: `GET /api/tenants/:id` matches on `tenant_code` (not UUID); `PATCH`/`DELETE` for tenants use UUID; availability endpoint returns per-slot `{ time, concurrent_guests, available_capacity }` array; slots run `12:00`–`21:30` in 30-min intervals; `concurrent_guests_time_limit` defaults to 120 mins.

- **Logging strategy**: Only log on genuine error conditions using `console.error`. Format: `[route-file] VERB description` with a context object containing relevant IDs. Validation failures, unexpected 404s (tenant missing inside POST /reservations), and D1 write errors are logged. Business-rule rejections (422) and expected 404s (GET not-found) are silent. Hono `logger()` middleware removed - too noisy for production Workers tail logs.
- **Body parsing for error context**: When a validation failure needs to log raw body fields (e.g. `tenant_id`), parse the body separately with `.catch(() => null)` before passing to `safeParse`, so the raw value is available even when schema validation fails.
- **D1 write error handling**: All write operations (INSERT, UPDATE, DELETE) are wrapped in try/catch. On catch, log with context and return 500. Not-found on DELETE is checked via `result.meta.changes === 0` - this is an expected 404, not an error, so no logging.



- **seed-admin.ts rewrite**: Replaced the print-SQL-and-copy-paste pattern with direct `execSync` execution of `npx wrangler d1 execute`. Eliminates PowerShell quoting issues with single-quoted SQL values inside double-quoted `--command` strings. Added `LOCAL=true` env var support to toggle `--local` flag for local dev vs production. Script now exits with code 1 on failure and prints a clear ✅/❌ result line. Added `tsx ^4.19.2` to `devDependencies` in `package.json` (was missing; script was always invoked via `npx tsx`).



- **Phase 2 admin routes**: Created `src/routes/admin.ts` with all 5 admin endpoints (`GET /me`, `PATCH /me`, `GET /reservations`, `PATCH /reservations/:id`, `DELETE /reservations/:id`), all protected by `adminAuth` middleware. Key patterns: `tenantId` always comes from `c.get('tenantId')` (JWT), never from request body or query params. Tenant isolation enforced at application layer (pre-fetch + ownership check) AND at SQL layer (`WHERE id = ? AND tenant_id = ?`). 404 is returned for both "not found" and "wrong tenant" to prevent resource enumeration. `UpdateTenantSchema` already omits `id`, `created_date`, `modified_date` but not `tenant_code` - strip `tenant_code` explicitly before building the UPDATE query. Also added optional `expiresInSeconds` param to `signJWT` (defaulting to 8h) because the test suite needed it to produce expired tokens.


- **No code comments directive (2026-04-07):** James directed that inline comments, explanatory comments, and JSDoc are not to be added to code changes unless the code is genuinely too complex to understand without one. Apply to all future code edits.

- **Planning artifacts location (2026-04-12):** Planning docs and design notes go in `.squad/temp/` - not in the Copilot session state directory.

- **Neela's phase 8 test requirements (drove phase 2 changes):** Tests depend on `signJWT` accepting an optional `expiresInSeconds` parameter (pass `-1` for an already-expired token). Tenant isolation for `PATCH`/`DELETE` must return 404, not 403, to avoid resource enumeration - tests verify the record is unmodified in the DB. `hashPassword` must be importable from `src/utils/auth` for test-time seed generation.

- Stack: Cloudflare Workers + Pages, D1 (SQLite), Hono
- Consistent API response shape: `{ success, data, error }`
- CORS must be handled for cross-origin widget requests
- **Concurrent guest limit**: `max_guests` is used as concurrent capacity limit (max guests in a time window). New `concurrent_guests_time_limit` (default 120 minutes) controls window size. Calculated in GET `/api/reservations/blocked-times` using time-distance formula.
- **Route ordering**: Specific routes (like `/blocked-times`) must be registered before parameterized routes (like `/:id`) to avoid route conflicts in Hono.
- **Schema files**: `schema.sql` is the source of truth for D1 structure and seed data. Migration files in `migrations/` handle incremental changes for existing deployments.
- **Concurrent-limit test data (2027-06-15, Oak Tavern)**: Added 4 reservations on `2027-06-15` for Oak Tavern to exercise concurrent guest logic. Lunch cluster: Grace Taylor 13:00 (4 guests) + Henry Evans 13:30 (4 guests) = 8 concurrent within the 120-min window - any further booking of ≥3 guests in that window should be blocked. Evening slots (Isabel Brown 19:00×3, Jack Wilson 20:00×2) are isolated from the lunch cluster. Also corrected Oak Tavern `max_covers` from accidentally-set `5` back to `50`.

