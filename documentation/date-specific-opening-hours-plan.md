# Date-Specific Opening Hours — Design & Implementation Plan

> **Prepared by:** Han (Technical Lead)  
> **Date:** 2026-07-08  
> **Status:** Ready for team sign-off

---

## Summary

Two closely-related requirements need to be satisfied:

1. **Date-specific hours override** — Christmas Day may have 14:00–18:00 even though it falls on a Thursday whose normal hours are 12:00–22:00.  
2. **Unblock a single date** — a venue closed every Monday wants to open for a one-off event on a specific Monday, without touching the rest of the recurring Monday closure.

Both requirements resolve to the same underlying concept: **a date-level schedule override that takes precedence over the weekly `OpeningHours` pattern**. One new table, one new concept. This plan designs, migrates, and wires it in.

**What we are NOT building in this iteration:**
- No bulk override import
- No recurrence in `DateOverrides` — still per-date only
- No admin dashboard UI for `DateOverrides` (Twinkie assesses in the work breakdown below; it may follow separately)
- No "preview resolved schedule for a month" endpoint

---

## Current Data Model — Findings

### `OpeningHours` (file: `db/schema.sql` lines 66–76, `migrations/0005_opening_hours.sql`)

```
id         TEXT PRIMARY KEY
tenant_id  TEXT  → FK Tenants(id) CASCADE
day_of_week  INTEGER  0–6 (0=Sunday, per Date.getDay() / strftime('%w'))
is_closed  INTEGER  0 or 1
open_time  TEXT  HH:MM or NULL
close_time TEXT  HH:MM or NULL
UNIQUE (tenant_id, day_of_week)
```

Seven rows per tenant, one per weekday. "Closed every Monday" = the row with `day_of_week=1, is_closed=1`. There is **no series / recurrence concept** — a DOW closure is a single row, not a sequence of dated rows.

**Critical implication for "unblock one Monday":** Because there are no individual dated rows for recurring closures, there is nothing to mutate or suppress in a targeted way. The unblock must be additive — a new override row that wins over the DOW row — and must not touch `OpeningHours` at all.

### `BlockedDates` (file: `db/schema.sql` lines 52–63, `migrations/0004_blocked_dates.sql`)

```
id          TEXT PRIMARY KEY
tenant_id   TEXT  → FK Tenants(id) CASCADE
date        TEXT  YYYY-MM-DD
start_time  TEXT  HH:MM or NULL
end_time    TEXT  HH:MM or NULL
reason      TEXT  optional
created_date TEXT
INDEX idx_blocked_dates_tenant_date (tenant_id, date)
```

This is an **admin-driven manual closure tool** (emergency blocks, one-off events, etc.). Multiple rows are allowed per `(tenant_id, date)` — one row per blocked window. A full-day block is `start_time IS NULL`. There is no `UNIQUE (tenant_id, date)` constraint, intentionally.

`BlockedDates` is semantically distinct from the schedule: it is an override administered by staff to suppress availability without changing the underlying schedule. It is checked **first** in the resolution chain (see `src/routes/availability.ts` lines 85–94 and `src/routes/reservations.ts` lines 113–137).

### Resolution logic today

**`GET /api/reservations/blocked-times`** (`src/routes/availability.ts` lines 62–158):  
1. Query `BlockedDates` for full-day block (`start_time IS NULL`) → return all slots blocked  
2. Compute DOW from `date + 'T12:00:00Z'` → query `OpeningHours(tenant_id, day_of_week)`  
3. If `is_closed=1` → return all slots blocked  
4. Generate slots within `open_time`/`close_time`  
5. Filter by partial `BlockedDates` windows, then by concurrent capacity

**`GET /api/reservations/blocked-dates`** (`src/routes/availability.ts` lines 7–59):  
- Admin-blocked dates come from `BlockedDates(start_time IS NULL)` via SQL  
- Venue-closed dates are computed in a **JavaScript loop** over all days in the month, checking `OpeningHours(is_closed=1)` DOW set  
- Returns `{ blocked_dates: string[], closed_dates: string[] }`

**`POST /api/reservations`** (`src/routes/reservations.ts` lines 113–162):  
1. Full-day `BlockedDates` check → 422  
2. Partial `BlockedDates` window check → 422  
3. `OpeningHours.is_closed=1` → 422  
4. Outside `open_time`/`close_time` → 422  
5. Atomic capacity insert

### Zod schemas today

- `OpeningHoursEntrySchema` / `UpsertOpeningHoursSchema` — `src/schema/index.ts` lines 100–137  
- `BlockedDateSchema` / `BlockDateBodySchema` — `src/schema/index.ts` lines 76–200  

Neither schema has a concept of date-specific schedule overrides.

---

## Recommended Approach — `DateOverrides` Table

### The unifying concept

A single new table `DateOverrides`, keyed `UNIQUE (tenant_id, date)`, carrying:

| Column | Semantics |
|---|---|
| `is_closed = 1` | This specific date is fully closed — regardless of what `OpeningHours(DOW)` says |
| `is_closed = 0, open_time, close_time` | This specific date uses these hours instead of the DOW row |

This one row type handles all four cases:

| Scenario | `is_closed` | `open_time / close_time` |
|---|---|---|
| Christmas Day (special hours, normally open Thursday) | 0 | 14:00 / 18:00 |
| Christmas Day (fully closed, normally open Thursday) | 1 | NULL / NULL |
| Unblock a Monday (closed every Monday, event on one) | 0 | 10:00 / 23:00 |
| Re-close a normally open day (e.g. staff training Tuesday) | 1 | NULL / NULL |

### Resolution precedence

```
AdminBlockedDate (BlockedDates, start_time IS NULL)
    ↓  if no full-day admin block
DateOverride (DateOverrides, keyed by exact date)
    ↓  if no override row
OpeningHours (OpeningHours, keyed by day_of_week)
    ↓  if no OpeningHours row
Default (open, use generateTimeSlots() defaults: 12:00–21:30)
```

**Why `BlockedDates` stays above `DateOverrides`:** Admin manually blocked dates are emergency/operational decisions. A schedule override (DateOverrides) should not accidentally unblock an emergency closure.

### SQL resolution pattern

A single query replaces the current two-step lookup in `blocked-times` and `reservations.ts`:

```sql
SELECT
    COALESCE(do.is_closed, oh.is_closed, 0)       AS effective_is_closed,
    COALESCE(do.open_time,  oh.open_time)          AS effective_open_time,
    COALESCE(do.close_time, oh.close_time)         AS effective_close_time
FROM (SELECT 1) AS _
LEFT JOIN DateOverrides do  ON do.tenant_id  = ?1 AND do.date         = ?2
LEFT JOIN OpeningHours  oh  ON oh.tenant_id  = ?1 AND oh.day_of_week  = ?3
```

Bind: `?1 = tenant_id`, `?2 = date (YYYY-MM-DD)`, `?3 = dow (0–6)`.

The result object is then used exactly like today's `openingHoursRow` — three fields, same conditional logic. No branching needed in the app layer to decide which table won; `COALESCE` handles it.

**Worked examples against the SQL:**

| Scenario | `do.*` | `oh.*` | `effective_is_closed` | `effective_open_time` |
|---|---|---|---|---|
| Normal Tuesday, no override | NULL | 0, 12:00, 21:30 | 0 | 12:00 |
| Monday, normally closed, no override | NULL | 1, NULL, NULL | 1 | NULL |
| Monday, DateOverride(is_closed=0, 10:00, 23:00) | 0, 10:00, 23:00 | 1, NULL, NULL | 0 | 10:00 |
| Thursday, DateOverride(is_closed=1) for Christmas | 1, NULL, NULL | 0, 12:00, 22:00 | 1 | NULL |
| Thursday, DateOverride(is_closed=0, 14:00, 18:00) for Boxing Day | 0, 14:00, 18:00 | 0, 12:00, 22:00 | 0 | 14:00 |
| No OpeningHours row (unconfigured tenant) | NULL | NULL | 0 | NULL → default |

---

## Schema — Migration DDL

Migration file: **`migrations/0011_date_overrides.sql`**

```sql
-- H-11: DateOverrides — date-specific schedule overrides.
-- A row here takes precedence over OpeningHours(day_of_week) for the named date.
-- is_closed=1: the venue is closed on this specific date regardless of the DOW row.
-- is_closed=0: the venue is open on this specific date using these hours (not the DOW row).
-- UNIQUE(tenant_id, date) ensures at most one override per date per tenant — safe to upsert.
CREATE TABLE DateOverrides (
    id           TEXT    PRIMARY KEY NOT NULL,
    tenant_id    TEXT    NOT NULL,
    date         TEXT    NOT NULL,    -- YYYY-MM-DD
    is_closed    INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
    open_time    TEXT,                -- HH:MM or NULL
    close_time   TEXT,                -- HH:MM or NULL
    reason       TEXT,
    created_date TEXT    DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE (tenant_id, date),
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_date_overrides_tenant_date ON DateOverrides(tenant_id, date);
```

Update **`db/schema.sql`** to add this table definition (matching the migration DDL above, without the comment header).

---

## Zod & API Changes

### New Zod schemas (`src/schema/index.ts`)

```ts
export const DateOverrideSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  is_closed: z.union([z.literal(0), z.literal(1)]),
  open_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  close_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  reason: z.string().nullable(),
  created_date: z.string().optional(),
});

export const UpsertDateOverrideSchema = z
  .object({
    is_closed: z.union([z.boolean(), z.literal(0), z.literal(1)]),
    open_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    close_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    reason: z.string().optional(),
  })
  .refine(
    (d) => {
      const closed = d.is_closed === true || d.is_closed === 1;
      if (closed) return true;
      return d.open_time != null && d.close_time != null;
    },
    { message: 'open_time and close_time are required when is_closed is false' },
  );

export type DateOverride = z.infer<typeof DateOverrideSchema>;
export type UpsertDateOverride = z.infer<typeof UpsertDateOverrideSchema>;
```

### New admin routes — `src/routes/date-overrides.ts`

All routes behind `adminAuth`. Response shapes follow `{ success: true, data: ... }` / `{ error: string }`.

```
GET    /api/admin/date-overrides?month=YYYY-MM
       → { success: true, data: DateOverride[] }
       Lists all overrides for the given month.

PUT    /api/admin/date-overrides/:date          (date = YYYY-MM-DD)
       Body: UpsertDateOverrideSchema
       → 200: { success: true, data: DateOverride }
       Creates or replaces the override for this date (INSERT OR REPLACE).
       Returns 400 if date param is invalid or body fails validation.

DELETE /api/admin/date-overrides/:date
       → 200: { success: true }
       Removes the override, restoring normal DOW behaviour.
       Returns 404 if no override exists for this date.
```

Register the router in `src/app.ts` at `/api/admin/date-overrides`.

### Changes to existing routes

**`src/routes/availability.ts` — `GET /blocked-times`** (lines 96–106):

Replace the current two-query pattern (DOW lookup → `OpeningHours`) with the COALESCE query above. The rest of the function (slot generation, partial block check, capacity check) is unchanged.

```ts
// Replace the single openingHoursRow query with:
const dow = new Date(date + 'T12:00:00Z').getUTCDay();
const effectiveHours = await c.env.maximum_bookings_db
  .prepare(
    `SELECT
       COALESCE(do.is_closed, oh.is_closed, 0)    AS is_closed,
       COALESCE(do.open_time,  oh.open_time)       AS open_time,
       COALESCE(do.close_time, oh.close_time)      AS close_time
     FROM (SELECT 1) AS _
     LEFT JOIN DateOverrides do ON do.tenant_id = ? AND do.date = ?
     LEFT JOIN OpeningHours  oh ON oh.tenant_id = ? AND oh.day_of_week = ?`,
  )
  .bind(tenantId, date, tenantId, dow)
  .first<{ is_closed: number; open_time: string | null; close_time: string | null }>();

// Then use effectiveHours exactly where openingHoursRow was used.
```

**`src/routes/availability.ts` — `GET /blocked-dates`** (lines 40–52):

The existing `closedDays` DOW loop must be modified to apply `DateOverrides` when present. The loop body changes from a pure DOW lookup to: check the override map first, fall back to the DOW set.

```ts
// After fetching closedDays from OpeningHours (unchanged)...

// Add: fetch all DateOverrides for the month
const { results: overrides } = await c.env.maximum_bookings_db
  .prepare('SELECT date, is_closed FROM DateOverrides WHERE tenant_id = ? AND date LIKE ?')
  .bind(tenantId, `${month}-%`)
  .run<{ date: string; is_closed: number }>();

const overrideMap = new Map(overrides.map((r) => [r.date, r.is_closed]));

// In the loop body, replace the plain closedDowSet check:
for (let day = 1; day <= daysInMonth; day++) {
  const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
  const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay();

  let isClosed: boolean;
  if (overrideMap.has(dateStr)) {
    isClosed = overrideMap.get(dateStr) === 1;
  } else {
    isClosed = closedDowSet.has(dow);
  }

  if (isClosed) closedDatesSet.add(dateStr);
}
```

This adds one extra D1 query per `/blocked-dates` call (the overrides fetch). Acceptable — the same endpoint already makes two queries and this one is keyed by `(tenant_id, date LIKE month%)`.

**`src/routes/reservations.ts` — `POST /api/reservations`** (lines 139–162):

Replace the `OpeningHours` lookup with the COALESCE query. Same pattern as `/blocked-times`. The outer conditional logic (`if (openingHours)`, `if (openingHours.is_closed === 1)`, etc.) is unchanged — just rename the variable to `effectiveHours`.

---

## Work Breakdown

### Sean — Backend (D1 / API)

**Depends on:** nothing; all backend-first

| # | Task | Notes |
|---|---|---|
| S-1 | Write `migrations/0011_date_overrides.sql` | Exact DDL above |
| S-2 | Update `db/schema.sql` | Add `DateOverrides` table definition |
| S-3 | Add `DateOverrideSchema` + `UpsertDateOverrideSchema` to `src/schema/index.ts` | |
| S-4 | Create `src/routes/date-overrides.ts` with `GET`, `PUT`, `DELETE` | `INSERT OR REPLACE` for PUT |
| S-5 | Register route in `src/app.ts` at `/api/admin/date-overrides` | |
| S-6 | Update `availability.ts` `/blocked-times` to use COALESCE query | SQL snippet above |
| S-7 | Update `availability.ts` `/blocked-dates` loop to apply `overrideMap` | Logic snippet above |
| S-8 | Update `reservations.ts` `POST` opening-hours check to use COALESCE query | |
| S-9 | Update `DATA_MODEL.md` — add `DateOverrides` section | Follow existing format |
| S-10 | Update `BUSINESS_LOGIC.md` — update resolution precedence, add `DateOverrides` reference | |

### Twinkie — Frontend (Widget / Admin UI)

**Depends on:** S-1 through S-8 (API must be deployed or mocked)

| # | Task | Notes |
|---|---|---|
| T-1 | **Assess** widget impact: the `closed_dates` array in `/blocked-dates` already absorbs `DateOverrides(is_closed=1)` and excludes unblocked dates. The widget should require **no changes** for date display — verify this by testing against the updated API. | No code expected unless T-2 surfaces a bug |
| T-2 | Spike: admin UI for managing `DateOverrides`. The admin settings page currently has an opening-hours panel; a date-override picker (calendar month view + per-day override modal) is the natural home. **Scope to be agreed with James** before implementation. This is likely a future phase. | Out of scope for this plan unless James signs off |

**Note for Twinkie:** the `closed_dates` array in the API response is the only widget-facing surface. If `DateOverrides` correctly populates / removes entries from that array (Sean's responsibility), the widget tooltip logic is unchanged. Confirm during integration test.

### Neela — Tests

**Depends on:** S-1 through S-8 complete

| # | Task | Notes |
|---|---|---|
| N-1 | `DateOverrides` API — GET/PUT/DELETE happy paths, 400/404 | New test file `test/date-overrides.spec.ts` |
| N-2 | PUT upsert: create then update same date — confirm only one row | Tests `UNIQUE (tenant_id, date)` |
| N-3 | Resolution: `DateOverride(is_closed=0)` unblocks a DOW-closed day in `/blocked-times` | Key scenario |
| N-4 | Resolution: `DateOverride(is_closed=1)` closes a DOW-open day in `/blocked-times` | |
| N-5 | Resolution: `DateOverride(is_closed=0, open_time, close_time)` overrides hours for a DOW-open day | |
| N-6 | Resolution: no override → falls through to `OpeningHours` DOW | Regression check |
| N-7 | `/blocked-dates` month: unblocked Monday no longer appears in `closed_dates` | |
| N-8 | `/blocked-dates` month: `DateOverride(is_closed=1)` on normally-open day appears in `closed_dates` | |
| N-9 | `POST /api/reservations` blocked by `DateOverride(is_closed=1)` → 422 | |
| N-10 | `POST /api/reservations` allowed on DOW-closed day when `DateOverride(is_closed=0)` present | |
| N-11 | `POST /api/reservations` respects `DateOverride` hours — outside window → 422 | |
| N-12 | Admin full-day `BlockedDates` still wins over `DateOverride(is_closed=0)` | Precedence test |
| N-13 | Midnight-crossing `DateOverride` hours (`open_time > close_time`) — slot boundary | Mirrors existing OH midnight test |
| N-14 | DELETE `DateOverride` → DOW behaviour restored in `/blocked-times` | |
| N-15 | Tenant isolation — `DateOverride` for tenant A does not affect tenant B | |

**Dependency graph:**

```
S-1, S-2, S-3
     ↓
S-4, S-5 (routes)
     ↓
S-6, S-7, S-8 (availability + reservations wiring)
     ↓
N-1 … N-15 (all tests)
     ↓
T-1 (widget integration verification)
```

---

## Edge Cases & Risks

### 1. Date format / timezone consistency

Every date in the system is `YYYY-MM-DD` TEXT. DOW is computed as `new Date(date + 'T12:00:00Z').getUTCDay()` to avoid local-timezone DST shifts. `DateOverrides.date` must follow the same convention. The `UpsertDateOverrideSchema` date param must be validated with the same regex as `BlockedDateSchema.date`. Sean should validate the `:date` path param on the PUT/DELETE routes — bad date → 400, not a runtime crash.

### 2. Existing reservations when a `DateOverride(is_closed=1)` is added

Blocking a date that already has reservations does not cancel those reservations. This is consistent with the existing `BlockedDates` behavior (see `BUSINESS_LOGIC.md` — blocking is additive, never retroactive). Document this clearly in the admin UI tooltip or runbook: "Adding a closure does not cancel existing bookings. Please cancel or contact affected guests manually."

### 3. Uniqueness and upsert correctness

`UNIQUE (tenant_id, date)` ensures one override per tenant per date. The `PUT` endpoint must use `INSERT OR REPLACE` (or `INSERT ... ON CONFLICT(tenant_id, date) DO UPDATE`) to guarantee clean upsert semantics without 409 errors. The admin user should be able to call PUT multiple times on the same date to update hours without first issuing a DELETE.

### 4. Interaction: full-day `BlockedDates` + `DateOverride(is_closed=0)` 

If a date has both an admin manual block (`BlockedDates, start_time IS NULL`) AND a `DateOverride(is_closed=0)`, the admin block wins — because the `BlockedDates` check happens first in both `/blocked-times` and `POST /reservations`. This is correct and intentional. However, it can be confusing in the UI. Twinkie should consider showing a warning in the admin if a manual block is set for a date that also has an override.

### 5. `closed_dates` and `blocked_dates` overlap

A date could theoretically appear in both `blocked_dates` (from an admin `BlockedDates` entry) and `closed_dates` (from a `DateOverride(is_closed=1)`). The frontend `DayCell` currently handles these as mutually exclusive sets; overlaps should be benign (a date blocked in both just looks blocked). Neela should add a test confirming the widget does not crash on overlap.

### 6. Partial `BlockedDates` windows within `DateOverride` hours

A `DateOverride` setting hours 14:00–18:00 combined with a partial `BlockedDates` window 16:00–17:00 composes correctly: the resolution gives `effective_open_time=14:00, effective_close_time=18:00`, then the slot generation produces slots 14:00–17:30, then the partial block removes 16:00 and 16:30. No special handling needed — the two systems compose naturally.

### 7. `is_closed=1` with times provided

An `UpsertDateOverrideSchema` that receives `is_closed=true` along with `open_time` and `close_time` — this is technically harmless (the COALESCE query only reads `open_time`/`close_time` when `is_closed=0` is the winning value). But it is confusing. Consider either: (a) stripping `open_time`/`close_time` to NULL on write when `is_closed=1`, or (b) returning a validation error. Recommendation: strip to NULL server-side in the PUT handler (consistent with what `opening-hours.ts` PUT already does at lines 48–51).

### 8. `GET /api/tenants/:id` public endpoint

The public tenant endpoint (`src/routes/tenants.ts`) returns `opening_hours` today. It does NOT need to expose `DateOverrides` — those are schedule-management data, not widget-bootstrap data. The widget resolves closed/open dates via `/blocked-dates` at calendar render time, which already incorporates overrides after Sean's changes to the month loop. **No change to the public tenant endpoint.**

---

## Open Questions for James

1. **Admin UI scope for this phase:** Should Twinkie build the admin `DateOverrides` management UI in this iteration, or land the backend/API first and do the UI as a follow-on? Recommendation: backend-first, UI second.

2. **Tooltip differentiation in the widget:** Currently `closed_dates` has one tooltip message ("venue closed"). Should a `DateOverride(is_closed=1)` on a normally-open day have a different tooltip (e.g. "closed for a special event") vs a normal DOW closure ("closed this day of the week")? If yes, the `/blocked-dates` response needs a third array or a richer structure. This would be a further extension. Recommendation: defer — keep `closed_dates` flat for now.

3. **`DateOverride` as a reason for `closed_dates`:** The `reason` column exists on `DateOverrides`. The widget currently shows no reason text. Do you want the reason surfaced in the tooltip? If yes, `/blocked-dates` needs to return override reasons alongside dates. Recommend deferring until the admin UI is built.

4. **Reservation creation: should `DateOverride` hours check happen for admin-created bookings?** Currently `POST /api/admin/reservations` (if it exists) may bypass the opening-hours check. Check whether admin bookings hit the same guard path. (`CreateAdminReservationSchema` exists in schema — check whether it goes through the same POST route or a separate one.)

