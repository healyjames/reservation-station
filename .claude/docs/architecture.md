# Architecture Guidelines

## Pattern

**Data-first, feature-organized Cloudflare Worker.** There is no formal hexagonal/layered split —
the architecture is driven by the data model (`documentation/DATA_MODEL.md`), not by a ports-and-
adapters or layered convention. Every feature is a thin projection of the underlying objects
(`Tenant`, `Reservation`, `AdminUser`, `BlockedDate`, `OpeningHours`).

- **Backend:** a single Cloudflare Worker (Hono) serving both the API and, via Vite, the frontend
  bundle. `src/app.ts` wires the Hono app; `src/index.ts` is the Worker entrypoint.
- **Frontend:** Preact, built with Vite, organized by app area under `src/frontend/`
  (`admin`, `booking`, `booking-widget`, `cancel`) plus a `shared` component library.

## Boundaries & dependency rules

- **Data first, always.** Any change touching a stored field must update `db/schema.sql`, the
  relevant file in `migrations/`, the Zod schema in `src/schema/index.ts`, and
  `documentation/DATA_MODEL.md` together — never one without the others. This is the project's
  primary invariant (see CLAUDE.md's "Data First" section).
- **Multi-tenancy is load-bearing.** Every table except `Tenants` carries a `tenant_id` FK with
  `ON DELETE CASCADE`. Any query or handler touching `Reservation`, `AdminUser`, `BlockedDate`, or
  `OpeningHours` must be scoped to the current tenant — an unscoped query is a cross-tenant data
  leak, not just a bug.
- **Validation at trust boundaries.** Zod schemas in `src/schema/` are the runtime contract for
  anything crossing a trust boundary (API request bodies, the public booking widget). Internal
  logic can use plain TypeScript types.
- **No separate Customer entity.** Customer details are embedded inline on each `Reservation` —
  don't introduce a Customer table or treat customer data as a shared/joinable entity.

## Where things go

- `src/routes/` — Hono route handlers (HTTP boundary; parse/validate input, call into logic, shape the response)
- `src/schema/` — Zod schemas; the validation contract at trust boundaries
- `src/db/` — D1 query helpers
- `src/middleware/` — Hono middleware (auth, tenant resolution, etc.)
- `src/emails/` — transactional email templates/sending
- `src/constants/` — shared constants (see CLAUDE.md's DRY Principles)
- `src/types/` — internal TypeScript types (not trust-boundary validation)
- `src/utils/` — shared pure helpers
- `src/frontend/shared/` — reusable Preact components used across the admin/booking/cancel apps
- `src/frontend/{admin,booking,booking-widget,cancel}/` — the individual frontend apps
- `db/schema.sql` — physical table definitions (end-state)
- `migrations/` — ordered, incremental SQL changes applied to production (never edit an applied one — add a new one)
- `documentation/DATA_MODEL.md` — canonical description of what's stored and why

## Anti-patterns (reject in review)

- A route handler that queries `Reservation`/`AdminUser`/`BlockedDate`/`OpeningHours` without a
  `tenant_id` filter.
- A schema/enum value used in code that isn't reflected in `src/schema/index.ts` (or vice versa).
- Editing an already-applied migration file instead of adding a new one.
- Introducing a persistent Customer entity instead of keeping customer details embedded on `Reservation`.
