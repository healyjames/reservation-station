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
