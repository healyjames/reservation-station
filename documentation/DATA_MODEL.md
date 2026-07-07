# Data Model

> **Data first.** This project is built around its data. Every feature, endpoint, and UI is a projection of the objects described here. If the data model is wrong, nothing above it works. Treat this document as the source of truth for **what** we store, **why**, and **how the objects relate**. Keep it in sync with `db/schema.sql`, the migrations in `migrations/`, and the Zod schemas in `src/schema/index.ts`.

## Overview

The system is **multi-tenant**. A `Tenant` is a single restaurant/venue. Everything else hangs off a tenant via a `tenant_id` foreign key, and every child row is deleted with its tenant (`ON DELETE CASCADE`).

```
Tenant (1) ──< Reservation      (customer bookings)
Tenant (1) ──< AdminUser         (staff logins)
Tenant (1) ──< BlockedDate       (closures / partial blocks)
Tenant (1) ──< OpeningHours      (weekly schedule, one row per weekday)
```

There is **no separate Customer table**. A customer is not a persistent entity — their details (name, telephone, email, dietary requirements) are captured inline on each `Reservation`. The same person booking twice produces two independent reservation rows. See [Customer (embedded)](#customer-embedded).

Canonical definitions live in three places that must always agree:

| Source | Role |
|---|---|
| `db/schema.sql` | Physical table definitions, indexes, seed data |
| `migrations/*.sql` | Ordered, incremental changes applied to production |
| `src/schema/index.ts` | Zod schemas — the runtime validation contract at trust boundaries |

---

## Tenant

A restaurant/venue. The root object. Identified publicly by `tenant_code` (used by the embeddable booking widget) and internally by `id`.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | Primary key. |
| `name` | TEXT | Display name, e.g. "The Red Cow". |
| `tenant_code` | TEXT | Public slug, lowercase alphanumeric + hyphens. **Unique.** Used by the widget to resolve a venue. |
| `max_guests` | INTEGER | Max party size per single booking. `0` = unlimited. |
| `max_covers` | INTEGER | Max **concurrent** guests in the venue. `0` = unlimited. |
| `status` | TEXT | `active` or `cancelled`. |
| `concurrent_guests_time_limit` | INTEGER | Minutes each booking occupies capacity (default `120`). Defines the concurrency window. |
| `contact_email` | TEXT | Venue email for notifications. **PII** — never exposed on the public tenant endpoint. |
| `created_date` | TEXT | Nullable timestamp. |
| `modified_date` | TEXT | Nullable timestamp. Injected server-side on update. |

**Keys & indexes:** `PRIMARY KEY (id)`, `UNIQUE idx_tenants_code (tenant_code)`.

`max_covers`, `max_guests`, and `concurrent_guests_time_limit` together drive the rolling occupancy model — see `BUSINESS_LOGIC.md`.

---

## Reservation

A single customer booking against a tenant. The highest-volume object and the one all capacity logic operates on.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | Primary key. |
| `tenant_id` | TEXT (UUID) | FK → `Tenants(id)`, cascade delete. |
| `first_name` | TEXT | Customer detail (1–50 chars). |
| `surname` | TEXT | Customer detail (1–50 chars). |
| `telephone` | TEXT | Customer detail. Validated `^\+?[\d\s\-]{7,15}$`. |
| `email` | TEXT | Customer detail. Also part of the dedupe + manage-token identity. |
| `reservation_date` | TEXT | `YYYY-MM-DD`. Must not be in the past (on create). |
| `reservation_time` | TEXT | `HH:MM` (24h). |
| `guests` | INTEGER | Party size (positive). |
| `dietary_requirements` | TEXT | Optional, ≤500 chars. |
| `created_date` | TEXT | Defaults to `CURRENT_TIMESTAMP`. |
| `modified_date` | TEXT | Defaults to `CURRENT_TIMESTAMP`. |
| `manage_token_hash` | TEXT | `SHA-256(HMAC(JWT_SECRET, "manage:{id}:{email}"))`. Authenticates customer-facing amend/cancel. NULL on pre-migration rows. |

**Keys & indexes:**
- `PRIMARY KEY (id)`
- `idx_booking_tenant (tenant_id)`
- `idx_reservations_tenant_date (tenant_id, reservation_date)` — the composite index behind every hot query (availability, blocked-times, capacity check, admin list).
- `UNIQUE idx_reservations_unique_booking (tenant_id, email, reservation_date, reservation_time)` — prevents duplicate bookings from double-clicks/retries.

### Customer (embedded)

There is intentionally no `Customer` table. The columns `first_name`, `surname`, `telephone`, `email`, and `dietary_requirements` **are** the customer, snapshotted at booking time. Consequences to keep in mind:

- Customer data is per-reservation. Editing one booking does not change another.
- The `email` field doubles as identity for two things: the unique-booking index and the manage-token hash.
- There is no customer history or profile. If we ever need one, it becomes a new first-class object with its own `id` and a FK from `Reservation`.

---

## AdminUser

A staff login scoped to one tenant. Powers the admin dashboard.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | Primary key. |
| `tenant_id` | TEXT (UUID) | FK → `Tenants(id)`, cascade delete. |
| `email` | TEXT | Login identity. **Unique** across all tenants. |
| `password_hash` | TEXT | Hashed password. Never returned to clients. |
| `failed_attempts` | INTEGER | Login lockout counter (default `0`). |
| `locked_until` | TEXT | Nullable lockout expiry timestamp. |
| `created_date` | TEXT | Defaults to `CURRENT_TIMESTAMP`. |
| `modified_date` | TEXT | Defaults to `CURRENT_TIMESTAMP`. |

**Keys & indexes:** `PRIMARY KEY (id)`, `UNIQUE idx_admin_users_email (email)`, `idx_admin_users_tenant (tenant_id)`.

---

## BlockedDate

An admin-defined closure. A row either blocks a **whole day** (times NULL) or a **partial window** (`start_time`/`end_time` set together). Consumed by the availability and booking-creation guards.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | Primary key. |
| `tenant_id` | TEXT (UUID) | FK → `Tenants(id)`, cascade delete. |
| `date` | TEXT | `YYYY-MM-DD`. |
| `start_time` | TEXT | `HH:MM` or NULL. Must be set together with `end_time`. |
| `end_time` | TEXT | `HH:MM` or NULL. |
| `reason` | TEXT | Optional note. |
| `created_date` | TEXT | Defaults to `CURRENT_TIMESTAMP`. |

**Keys & indexes:** `PRIMARY KEY (id)`, `idx_blocked_dates_tenant_date (tenant_id, date)`.

**Rule:** `start_time` and `end_time` are all-or-nothing — both present (partial block) or both absent (full-day block).

---

## OpeningHours

The weekly schedule. Exactly **seven rows per tenant**, one per weekday. Determines whether a requested booking time falls inside trading hours (including midnight-crossing schedules).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | Primary key. |
| `tenant_id` | TEXT (UUID) | FK → `Tenants(id)`, cascade delete. |
| `day_of_week` | INTEGER | `0`–`6`. Unique per tenant. |
| `is_closed` | INTEGER | `0` or `1`. |
| `open_time` | TEXT | `HH:MM` or NULL (when closed). |
| `close_time` | TEXT | `HH:MM` or NULL (when closed). |

**Keys & indexes:** `PRIMARY KEY (id)`, `UNIQUE (tenant_id, day_of_week)`.

**Rule:** upserts must cover all seven days exactly once (enforced by `UpsertOpeningHoursSchema`).

---

## Relationships & integrity

- Every child object references its tenant with `FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE`. Deleting a tenant removes all of its reservations, admin users, blocked dates, and opening hours.
- Uniqueness is enforced at the database level, not just in code: `tenant_code`, admin `email`, the composite reservation dedupe key, and one opening-hours row per `(tenant_id, day_of_week)`.
- Validation at trust boundaries is enforced by the Zod schemas in `src/schema/index.ts`. **Any change to a column, enum, or constraint must be reflected in both the SQL and the matching Zod schema in the same change.**

## When you change the data

1. Add a migration in `migrations/` (never edit an applied one).
2. Update `db/schema.sql` to match the new end-state.
3. Update the corresponding Zod schema in `src/schema/index.ts`.
4. Update this document.
5. If capacity/availability behaviour changes, update `BUSINESS_LOGIC.md` too.
