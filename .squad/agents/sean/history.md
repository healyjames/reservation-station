# Sean — History

## Core Context

Backend Dev on the Reservation Station project. Owns the Hono API, D1 database schema, Cloudflare Workers configuration.

**User:** James Healy  
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph  

## Key File Paths

- `src/` — Worker source
- `wrangler.jsonc` — config
- `worker-configuration.d.ts` — generated bindings (run `wrangler types`)
- `migrations/` — D1 SQL migrations

## Learnings

- **README API reference**: Replaced the brief `### Tenant API` bullet list with a full `## API Reference` section covering all 12 endpoints across tenants and reservations. Key accuracy points: `GET /api/tenants/:id` matches on `tenant_code` (not UUID); `PATCH`/`DELETE` for tenants use UUID; availability endpoint returns per-slot `{ time, concurrent_guests, available_capacity }` array; slots run `12:00`–`21:30` in 30-min intervals; `concurrent_guests_time_limit` defaults to 120 mins.

- **Logging strategy**: Only log on genuine error conditions using `console.error`. Format: `[route-file] VERB description` with a context object containing relevant IDs. Validation failures, unexpected 404s (tenant missing inside POST /reservations), and D1 write errors are logged. Business-rule rejections (422) and expected 404s (GET not-found) are silent. Hono `logger()` middleware removed — too noisy for production Workers tail logs.
- **Body parsing for error context**: When a validation failure needs to log raw body fields (e.g. `tenant_id`), parse the body separately with `.catch(() => null)` before passing to `safeParse`, so the raw value is available even when schema validation fails.
- **D1 write error handling**: All write operations (INSERT, UPDATE, DELETE) are wrapped in try/catch. On catch, log with context and return 500. Not-found on DELETE is checked via `result.meta.changes === 0` — this is an expected 404, not an error, so no logging.



- Project kickoff: 2026-04-01
- Stack: Cloudflare Workers + Pages, D1 (SQLite), Hono
- Consistent API response shape: `{ success, data, error }`
- CORS must be handled for cross-origin widget requests
- **Concurrent guest limit**: `max_guests` is used as concurrent capacity limit (max guests in a time window). New `concurrent_guests_time_limit` (default 120 minutes) controls window size. Calculated in GET `/api/reservations/blocked-times` using time-distance formula.
- **Route ordering**: Specific routes (like `/blocked-times`) must be registered before parameterized routes (like `/:id`) to avoid route conflicts in Hono.
- **Schema files**: `schema.sql` is the source of truth for D1 structure and seed data. Migration files in `migrations/` handle incremental changes for existing deployments.
- **Concurrent-limit test data (2027-06-15, Oak Tavern)**: Added 4 reservations on `2027-06-15` for Oak Tavern to exercise concurrent guest logic. Lunch cluster: Grace Taylor 13:00 (4 guests) + Henry Evans 13:30 (4 guests) = 8 concurrent within the 120-min window — any further booking of ≥3 guests in that window should be blocked. Evening slots (Isabel Brown 19:00×3, Jack Wilson 20:00×2) are isolated from the lunch cluster. Also corrected Oak Tavern `max_covers` from accidentally-set `5` back to `50`.

