# Sean - History

## Core Context

Backend Dev on the Maximum Bookings project. Owns the Hono API, D1 schema/migrations, and Cloudflare Workers runtime configuration.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph

## Key File Paths

- `src/` - Worker source
- `wrangler.jsonc` - config
- `worker-configuration.d.ts` - generated bindings
- `migrations/` - D1 SQL migrations

## Recent Learnings

### Blocked-times API optimisation analysis (2026-07-02)

- The current debounce + abort + 60-second cache pattern is already acceptable for normal widget traffic.
- The main waste is narrower: unlimited-capacity tenants (`max_covers = 0`) still generate guest-specific requests even though the backend response ignores `guests`, and manage-booking does not share the same blocked-times cache path.
- Lowest-risk follow-up: share the blocked-times fetch/cache utility across widget and manage-booking, then make unlimited-capacity cache keys date-level instead of guest-level.
- If a larger redesign is ever needed, keep capacity math server-side and return a date-level `{ success, data }` payload with opening-hours state, hard-block context, and per-slot `availableCapacity`.

### Cache-Control headers (2026-07-02)

- `GET /api/reservations/blocked-dates` uses `Cache-Control: public, max-age=300`.
- `GET /api/reservations/blocked-times` uses `Cache-Control: private, max-age=60`.
- `GET /api/tenants/:id` uses `Cache-Control: public, max-age=3600`.

### Rolling occupancy capacity (2026-06-12)

- `max_covers` is the venue-wide concurrent seat cap, not a day-total covers limit.
- `GET /api/reservations/blocked-times` and `POST /api/reservations` must both use same-day reservations plus `calculateConcurrentGuests()` with `concurrent_guests_time_limit`.
- The legacy `/daily-capacity` route and related docs/tests/types are obsolete.

### Tenant protection + public projection (2026-06-12)

- Tenant CRUD routes use `superAdminAuth` with `X-Admin-Key` / `SUPER_ADMIN_KEY`.
- `GET /api/tenants/:id` stays public for widget bootstrap but must return only widget-safe fields.

### Backend guardrails

- Keep API responses on the `{ success, data, error }` convention where possible.
- Register literal Hono routes before parameter routes.
- Log only genuine failures with `console.error`; expected business-rule rejections and expected 404s stay silent.
- Wrap D1 writes in `try/catch`; expected delete misses are checked through `result.meta.changes === 0`.
- `schema.sql` is the source of truth; migrations carry incremental deployment changes.
- `contact_email` is required on `Tenants`.

### Admin reservations month filter (2026-07-03)

- `GET /api/admin/reservations` now accepts `?month=YYYY-MM` for calendar-based month loads from the admin dashboard.
- Validation uses regex `/^\d{4}-\d{2}$/`; invalid format returns 400.
- Filter uses a LIKE query on the date column; results are ORDER BY for consistent ordering.
- 3 backend tests added to `test/admin.spec.ts`; Neela added a further 3 covering empty-result month, `?month` precedence over `?date`, and tenant isolation.
