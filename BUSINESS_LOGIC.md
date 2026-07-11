# Business Logic: Reservation Capacity

> **Data first.** This project is data-focused — the capacity rules below only make sense in terms of the underlying objects. For the definition of every object (`Tenant`, `Reservation`, the embedded customer, `AdminUser`, `BlockedDate`, `OpeningHours`), their columns, keys, and relationships, read [`documentation/DATA_MODEL.md`](documentation/DATA_MODEL.md). Fields referenced throughout this file (`max_covers`, `max_guests`, `concurrent_guests_time_limit`, `reservation_date`, `reservation_time`, `guests`, etc.) are all defined there.

## Rolling Occupancy Model

Maximum Bookings uses a **rolling occupancy model** to manage venue capacity. Capacity is a *concurrent* constraint, not a daily total.

### Core Principle

> At any point in time, the sum of all active bookings (those whose sitting window overlaps with a given time slot) must not exceed `max_covers`.

A booking occupies capacity for a fixed duration defined by `concurrent_guests_time_limit`. Two bookings are **concurrent** if the absolute difference between their start times is less than `concurrent_guests_time_limit` minutes.

---

## Configuration

| Field | Meaning | Where set |
|---|---|---|
| `max_covers` | Maximum concurrent guests (venue physical capacity). `0` = unlimited. | Admin › General Settings › Max capacity |
| `concurrent_guests_time_limit` | Duration in minutes that each booking occupies capacity (e.g. 120 = 2-hour sitting). | Admin › General Settings |
| `max_guests` | Maximum party size per individual booking. `0` = unlimited. | Admin › General Settings › Max party size (per booking) |

`max_covers` and `max_guests` are independent controls:
- `max_covers` limits how many guests can be *in the venue at once*.
- `max_guests` limits the size of any *single booking*.

---

## Examples

### Example 1 — Full capacity blocks the window only

**Configuration:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`

| Booking | Time | Guests |
|---|---|---|
| A | 20:00 | 8 |

**Resulting occupancy:**

| Time window | Active covers |
|---|---|
| 20:00–22:00 | 8 |

**Availability:**

| Time | Remaining capacity |
|---|---|
| Before 20:00 | 8 (full capacity available) |
| 20:00–21:59 | 0 (fully booked) |
| 22:00+ | 8 (fully available again) |

A booking at 18:00 is allowed. A booking at 20:30 is not. A booking at 22:00 is allowed again.

---

### Example 2 — Partial capacity reduces availability in the window

**Configuration:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`

| Booking | Time | Guests |
|---|---|---|
| A | 20:00 | 6 |

**Resulting occupancy:**

| Time window | Active covers |
|---|---|
| 20:00–22:00 | 6 |

**Availability:**

| Time | Remaining capacity |
|---|---|
| 20:00–21:59 | 2 (only parties of 1–2 can book) |
| 22:00+ | 8 |

---

### Example 3 — Overlapping bookings create a step function

**Configuration:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`

| Booking | Time | Guests |
|---|---|---|
| A | 20:00 | 6 |
| B | 21:00 | 2 |

Booking B at 21:00 is concurrent with Booking A (|21:00 - 20:00| = 60 min < 120 min).

**Resulting occupancy:**

| Time window | Active covers |
|---|---|
| 20:00–20:59 | 6 (only A) |
| 21:00–21:59 | 8 (A + B) |
| 22:00–22:59 | 2 (only B, A has ended) |
| 23:00+ | 0 |

**Availability:**

| Time | Remaining capacity |
|---|---|
| 20:00–20:59 | 2 |
| 21:00–21:59 | 0 (fully booked) |
| 22:00–22:59 | 6 |
| 23:00+ | 8 |

---

## Code References

### Core concurrent calculation

**`src/utils/slots.ts` — `calculateConcurrentGuests`**

```ts
export function calculateConcurrentGuests(
  slotTime: string,           // "HH:MM"
  reservations: SlotReservation[],
  timeLimitMinutes: number
): number
```

Returns the total guests from all reservations whose start time is within `timeLimitMinutes` of `slotTime`. Two bookings are concurrent when `|slot - booking| < timeLimitMinutes`.

Also see `generateTimeSlots` in the same file for how available time slots are produced.

---

### API: booking creation guard

**`src/routes/reservations.ts` — `POST /api/reservations`**

When a reservation is submitted, the API:
1. Fetches all existing reservations for `(tenant_id, reservation_date)`.
2. Calls `calculateConcurrentGuests(reservation_time, dayReservations, concurrent_guests_time_limit)`.
3. Rejects with **422** if `concurrent + new_guests > max_covers`.
4. `max_covers = 0` skips the check entirely (unlimited).

---

### API: blocked time slots

**`src/routes/reservations.ts` — `GET /api/blocked-times`**

Returns the list of time strings that are unavailable for a given `(tenant_id, date, guests)` combination.

For each candidate time slot, calls `calculateConcurrentGuests` and marks the slot as blocked if `concurrent + requested_guests > max_covers`.

Uses `max_covers` (concurrent capacity) — not `max_guests` (party size limit).

---

### API: full availability grid

**`src/routes/reservations.ts` — `GET /api/availability`**

Returns a full month's worth of dates and their available time slots. Each slot is evaluated using the same concurrent window logic. Dates where all time slots are blocked are marked as unavailable.

---

### Frontend: party size selector

**`src/frontend/shared/components/BookingWidget/Step1Form.tsx`**

The guest count dropdown is bounded by:
```ts
const partyLimit = max_guests > 0
  ? max_guests
  : (max_covers > 0 ? max_covers : 20);
```

`max_guests` takes precedence over `max_covers` as the upper bound on party size.

---

### Frontend: fetching blocked times

**`src/frontend/shared/hooks/useAvailability.ts` — `fetchBlockedTimes`**

Called when a date is selected in the booking widget. Fetches `GET /api/blocked-times` and populates the `blockedTimes` signal, which `Step1Form` uses to disable unavailable time slots.

---

### Admin: configuration UI

**`src/frontend/shared/components/Admin/GeneralSettings.tsx`**

The **Max capacity** field sets `max_covers`. The **Max party size (per booking)** field sets `max_guests`. Both accept `0` to mean unlimited.

---

## CORS Security Strategy

**`src/app.ts`**

In development (`ENVIRONMENT === 'development'`), all origins are allowed. In production, any HTTPS origin is permitted so the booking widget can be embedded on any restaurant website. Security is enforced by route-level credentials (admin JWT / manage token), not by origin-checking.

---

## Tenant Endpoint: PII Protection

**`src/routes/tenants.ts` — `GET /api/tenants/:id`**

The public tenant endpoint returns an explicit column allowlist: `id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit`. Fields such as `contact_email`, `created_date`, and `modified_date` are intentionally excluded to avoid leaking PII to unauthenticated callers. Use `GET /api/admin/me` for admin access to the full tenant record.

---

## Admin Tenant PATCH: Server-Side `modified_date`

**`src/routes/admin.ts` — `PATCH /api/admin/tenant`**

`modified_date` is injected server-side and removed from the client-submitted payload. This means the client can never fake a modification timestamp. `tenant_code` is also stripped from PATCH requests to prevent it from being changed.

---

## Tenant Onboarding

**`src/routes/tenants.ts` — `POST /api/tenants`**

Tenant onboarding is a super-admin operation gated by `X-Admin-Key` / `SUPER_ADMIN_KEY`. One request creates the tenant, first admin user, and all seven opening-hours rows atomically; omitted opening hours default to closed days until the owner configures them.

---

## Booking Creation: Validation Order

**`src/routes/reservations.ts` — `POST /api/reservations`**

Reservation creation validates in this order:
1. Full-day block check — rejects if the date has a full-day `BlockedDates` entry.
2. Partial-day time block check — rejects if the requested time falls within an admin-defined partial-day block.
3. Opening hours check — rejects if the restaurant is closed that day, or if the time is outside configured hours (including midnight-crossing schedules).
4. Capacity check — atomic INSERT with a WHERE clause that re-evaluates concurrent occupancy inside the same SQL statement, eliminating the SELECT-then-INSERT race condition.

---

## Manage Token: Regenerated on Email Change

**`src/routes/reservations.ts` — `PATCH /api/reservations/:id`** (customer-facing)

When a customer amends their email address, the manage token is regenerated and the new hash is stored. This keeps the amendment/cancellation email link valid for the new email address.

---

## `contact_email` Field Availability

**`src/frontend/shared/types/tenant.ts` — `TenantConfig`**

The `contact_email` field is only present when `TenantConfig` is loaded via admin-authenticated endpoints (e.g. `GET /api/admin/me`). It is intentionally absent from the public `GET /api/tenants/:id` widget endpoint to prevent PII exposure.

---

## Monthly Database Export (Cron)

**`src/cron/monthly-export.ts`** — `runMonthlyExport`, invoked by the `scheduled` handler in **`src/index.ts`**.

A [Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/) runs the Worker on a schedule (configured in `wrangler.jsonc` under `triggers.crons`; **times are UTC**). The default `"0 8 1 * *"` fires at 08:00 UTC on the 1st of every month.

On each run it:
1. Discovers every user table dynamically from `sqlite_master` (excludes `sqlite_%`, `_cf_%`, `d1_%`), so new tables are included automatically.
2. Dumps each table to its own CSV (one attachment per table) and emails them via Resend to `REPORT_RECIPIENT`.
3. Redacts sensitive columns (`password_hash`) — the value is replaced with `[redacted]` while the column is still listed.

Because the Worker also serves HTTP, `src/index.ts` exports an object with **both** `fetch` (delegating to the Hono app) and `scheduled`. The export runs inside `ctx.waitUntil(...)` so the Worker stays alive until the email is sent.

**Configuration** (set in `.env` for local dev, or the Cloudflare dashboard for production):

| Var | Meaning |
|---|---|
| `REPORT_RECIPIENT` | Where the export is emailed. |
| `REPORT_SENDER` | `from` address — **must** be on a Resend-verified domain. |
| `RESEND_API_KEY` | Resend API key (secret). |

If `REPORT_RECIPIENT` / `REPORT_SENDER` / `RESEND_API_KEY` are unset, the run logs a warning and skips — it never throws. Test locally with `npx wrangler dev --test-scheduled`.

---

## CSV Booking Migration

**`scripts/prepare-migration-from-csv.ts`** — CSV-driven migration notifier (no production DB reads).

Used to import a third-party booking export (e.g. Dojo) and notify those customers that their booking has moved. The full end-to-end process — column mapping, transforms, timezone handling, capacity notes, and safety gates — is documented in [`documentation/csv-booking-migration-runbook.md`](documentation/csv-booking-migration-runbook.md).

Manage links are backed by a deterministic token so re-runs are idempotent:

```
token = HMAC-SHA256(JWT_SECRET, "manage:{reservationId}:{lowercased-email}")   // hex
hash  = SHA-256(token)                                                          // stored in Reservations.manage_token_hash
```

This matches `src/utils/manageToken.ts` exactly. The link carries the plaintext token; the DB stores only the hash. Imported rows start with `manage_token_hash = NULL` (dead links) until backfilled.

**Modes:**
- *(default)* — generate `db/prod-migration-backfill.sql` (one `UPDATE` per row) and print the manage URLs. No DB access, no email.
- `--parity <id>` — print one row's `UPDATE` + live URL to click. Confirms production `JWT_SECRET` parity **before** anything irreversible; if the link doesn't validate, all links would be dead.
- `--send [--dry-run] [--only <email>]` — email the migration notice via Resend (`--dry-run` lists recipients without sending).

Inputs are `export.csv` (ground-truth prod rows) and the original CSV (for dietary notes). Config from `.env`: `JWT_SECRET`, `RESEND_API_KEY`, `PUBLIC_URL`. The migration email template is `src/emails/customer-migration.ts`.

> **Note:** `scripts/send-migration-emails.ts` is an alternative D1-driven runner (local preview/test/backfill/send). Prefer the CSV-driven script for production — it performs no prod reads.

