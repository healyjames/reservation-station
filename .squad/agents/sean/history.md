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
- **seed-today-bookings.ts**: Created `scripts/seed-today-bookings.ts` to insert 15 test reservations (5 per tenant) for today's date. Follows the `seed-admin.ts` pattern exactly: `execSync` per INSERT (not batched), `LOCAL=true` env var for `--local` flag, `crypto.randomUUID()` for IDs, ✅/❌ logging with exit(1) on failure. Bookings are spread across 12:00/13:00 lunch and 18:00/19:00/20:00–20:30 evening slots; guest counts stay within each tenant's `max_guests` concurrent limit per 120-min window. Oak Tavern's `block_current_day=1` is noted in a comment.

- **Concurrent-limit test data (2027-06-15, Oak Tavern)**: Added 4 reservations on `2027-06-15` for Oak Tavern to exercise concurrent guest logic. Lunch cluster: Grace Taylor 13:00 (4 guests) + Henry Evans 13:30 (4 guests) = 8 concurrent within the 120-min window - any further booking of ≥3 guests in that window should be blocked. Evening slots (Isabel Brown 19:00×3, Jack Wilson 20:00×2) are isolated from the lunch cluster. Also corrected Oak Tavern `max_covers` from accidentally-set `5` back to `50`.

- **Tenants table missing date columns (migration 0003)**: The `Tenants` table was created without `created_date` and `modified_date` columns, unlike `Reservations` and `AdminUsers` which both have them. The `PATCH /api/admin/me` route sets `modified_date` on every update, causing a D1_ERROR 500 at runtime. Migration `0003_tenants_dates.sql` adds both columns with `DEFAULT (CURRENT_TIMESTAMP)` to bring `Tenants` in line with the other tables. `schema.sql` was updated to match.

 Changed `block_current_day` in `TenantSchema` from `z.boolean()` to `z.union([z.boolean(), z.literal(0), z.literal(1)])`. The frontend sends integer `1`/`0` per established design decision, and D1/SQLite stores and returns booleans as integers. The strict `z.boolean()` was rejecting valid payloads with a 400. No other files required changes.

- **Admin GET /blocked-dates month param**: Extended the GET handler to accept `?month=YYYY-MM` alongside the existing `?date=YYYY-MM-DD`. When `month` is present, validates format with `/^\d{4}-\d{2}$/` and queries `date LIKE 'YYYY-MM-%'`, returning all rows for that tenant/month. When neither param is present, returns 400 `{ error: 'date or month is required' }`. Single-date path is unchanged. No new schema types needed — same `BlockedDate` type and same response shape (array of full rows).

- **Opening Hours backend (migration 0005)**: Added `OpeningHours` table (id, tenant_id, day_of_week 0–6, is_closed, open_time, close_time) with UNIQUE(tenant_id, day_of_week) and CASCADE delete. `generateTimeSlots()` now accepts `openTime`/`closeTime` params (defaults preserve existing 12:00–21:30 behaviour via exclusive upper bound 22:00). Admin routes `GET/PUT /api/admin/opening-hours` use `{ success, data }` envelope; protected by `adminAuth`. `PUT` uses D1 batch for atomic replace (DELETE + 7 INSERTs). `GET /api/tenants/:id` now includes `opening_hours` field (array or null). `GET /api/reservations/blocked-dates` unions BlockedDates full-day rows with any dates in the month that fall on a closed day_of_week. `GET /api/reservations/blocked-times` fetches the OpeningHours row for the date's DOW: if `is_closed=1`, returns all default slots blocked; otherwise uses `generateTimeSlots(open_time, close_time)` throughout the capacity logic. Backward compat: tenants with no OpeningHours rows get default 12:00–21:30 slot window on all days.

- **Route ordering in blocked-dates.ts**: `DELETE /date/:date` registered before `DELETE /:id` to avoid the literal segment `date` being swallowed by the `:id` parameter.
- **Han's schema.ts coordination**: Han had already added `BlockedDateSchema`/`CreateBlockedDateSchema` and removed `block_current_day` from `TenantSchema` before this run. `CreateBlockedDateSchema` includes `tenant_id` and uses `.nullable()` (not `.optional()`) for time fields — incompatible with the admin route's body contract (tenant comes from JWT, time fields are optional). Used a local `BlockDateBodySchema` in `blocked-dates.ts` for body validation while still importing the Han-defined types for DB row typing.

- **GET /api/tenants/:id accepts UUID or tenant_code (2026-05-21)**: The handler now detects whether `:id` matches the UUID pattern (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) and queries `WHERE id = ?` for UUIDs or `WHERE tenant_code = ?` otherwise. Response shape (including `opening_hours`) is unchanged. Required by manage-booking page which holds tenant UUID from reservation record.

- **Booking update availability validation — proposed (2026-05-21)**: A shared reservation-availability validator should be extracted in `src/routes/reservations.ts` and used for both `POST` and `PATCH /api/reservations/:id`. PATCH currently skips blocked-date and opening-hours checks, so users can move a reservation onto an unavailable date. PATCH must load existing reservation first to exclude it from capacity checks. Non-date-field edits should skip availability revalidation. Not yet implemented.

- **Phase 1 infrastructure — wrangler.jsonc + package.json (2026-05-23)**: Added `assets` block to `wrangler.jsonc`: `directory: ./dist` (Vite build output) and `not_found_handling: single-page-application` (Cloudflare SPA mode — unmatched paths serve `index.html`, required for client-side routing across all three surfaces). Added `vite ^6.0.0` and `concurrently ^9.0.0` to devDependencies; Preact packages (`preact`, `@preact/preset-vite`, `@preact/signals`) in dependencies. New scripts: `dev` runs `concurrently "wrangler dev" "vite"` (Worker on 8787, Vite on 5173); `build` runs `vite build`; `deploy` runs build then `wrangler deploy`.

- **Public cancellation API contract**: `GET /api/reservations/:id` and `DELETE /api/reservations/:id` already exist on the public reservations router mounted at `/api/reservations` in `src/app.ts`; neither uses `adminAuth`. `GET` returns the raw reservation row from `SELECT *`, so the cancel flow can read `id`, `first_name`, `surname`, `email`, `reservation_date`, `reservation_time`, `guests`, and `dietary_requirements` directly by UUID. `DELETE` permanently deletes by reservation UUID and returns `{ success: true }`, with 404 `{ error: 'Reservation not found' }` when missing.

