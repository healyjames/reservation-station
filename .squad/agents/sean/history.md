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

### Tenant onboarding backend decision (2026-07-07)

- Existing `superAdminAuth`, `SUPER_ADMIN_KEY`, and `POST /api/tenants` are the right primitives for tenant onboarding.
- Coordinator route-location decision: extend `POST /api/tenants`, not `/api/admin/tenants`, because `/api/admin/*` is tenant-scoped JWT admin space.
- Implementation should fill missing tenant fields, create first admin/opening-hours as needed, use prepared statements plus D1 `db.batch()`, and retire production use of `scripts/seed-admin.ts` as a direct SQL writer.

## Learnings

### Tenant onboarding validation handoff (2026-07-07)

- Neela approved the final nested onboarding contract with 30 isolated `test/tenants.spec.ts` tests passing.
- The implementation contract in `documentation/tenant-onboarding-runbook.md` is now the operator reference for secure onboarding.

### DateOverrides — pending work (2026-07-08)

- Han produced `documentation/date-specific-opening-hours-plan.md` and the decision record for a new `DateOverrides` table.
- Sean's pending items: write migration `0011_date_overrides.sql`, add schema types, rewrite the two-step `OpeningHours` lookup in `availability.ts` and `reservations.ts` to the COALESCE LEFT JOIN pattern, and add admin CRUD endpoints for DateOverrides rows.
- Key rule: `BlockedDates` admin blocks always win; `DateOverrides` beats `OpeningHours(DOW)`; unblocking a normally-closed weekday is purely additive via a DateOverride row — never mutate `OpeningHours`.

### Tenant onboarding implementation (2026-07-07)

- Final onboarding contract is nested: `{ tenant: CreateTenantSchema fields, admin: { email, password }, opening_hours? }`; admin passwords require at least 12 characters.
- `POST /api/tenants` is now the super-admin onboarding operation and replaces tenant-only creation.
- New tenants are created with tenant row, first admin user, and seven opening-hours rows in one D1 `batch()` transaction; omitted opening hours default to closed.
- `scripts/seed-admin.ts` has been removed in favour of the protected API plus `documentation/tenant-onboarding-runbook.md`.
