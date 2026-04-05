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

- Project kickoff: 2026-04-01
- Stack: Cloudflare Workers + Pages, D1 (SQLite), Hono
- Consistent API response shape: `{ success, data, error }`
- CORS must be handled for cross-origin widget requests
- **Concurrent guest limit**: `max_guests` is used as concurrent capacity limit (max guests in a time window). New `concurrent_guests_time_limit` (default 120 minutes) controls window size. Calculated in GET `/api/reservations/blocked-times` using time-distance formula.
- **Route ordering**: Specific routes (like `/blocked-times`) must be registered before parameterized routes (like `/:id`) to avoid route conflicts in Hono.
- **Schema files**: `schema.sql` is the source of truth for D1 structure and seed data. Migration files in `migrations/` handle incremental changes for existing deployments.
- **Concurrent-limit test data (2027-06-15, Oak Tavern)**: Added 4 reservations on `2027-06-15` for Oak Tavern to exercise concurrent guest logic. Lunch cluster: Grace Taylor 13:00 (4 guests) + Henry Evans 13:30 (4 guests) = 8 concurrent within the 120-min window — any further booking of ≥3 guests in that window should be blocked. Evening slots (Isabel Brown 19:00×3, Jack Wilson 20:00×2) are isolated from the lunch cluster. Also corrected Oak Tavern `max_covers` from accidentally-set `5` back to `50`.

