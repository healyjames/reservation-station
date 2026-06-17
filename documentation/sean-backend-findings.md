# Sean's Backend Findings — Production-Readiness Review 2

**Reviewer:** Sean (Backend Developer)  
**Date:** 2026-06-15  
**Files audited:**
- `src/routes/reservations.ts`
- `src/routes/admin.ts`
- `src/routes/tenants.ts`
- `src/routes/opening-hours.ts`
- `src/routes/blocked-dates.ts`
- `src/routes/auth.ts`
- `src/db/schema.sql`
- `src/db/schema.ts`
- `migrations/0001` – `0010`
- `src/utils/slots.ts`
- `BUSINESS_LOGIC.md`

---

## H-11 — Admin POST `/api/admin/reservations` bypasses all checks

**Status: ✅ FIXED (2026-06-16)**

`admin.ts` now fetches `status, max_guests, max_covers, concurrent_guests_time_limit, contact_email` from Tenants before INSERT. Guards applied in order: tenant status → max_guests party size → full-day blocked date check → atomic `INSERT … SELECT … WHERE (capacity_check)`. Opening hours intentionally not enforced (admins may legitimately override hours). `meta.changes === 0` returns 422 if capacity exceeded.

---

## H-14 — `/api/availability` capacity model

**Status: RESOLVED**

The coordinator noted concern that `available_capacity` uses `max_covers`. On review this is correct:

- `max_covers` = concurrent seating capacity (venue-level ceiling)
- `max_guests` = maximum party size per individual booking

`/api/availability` (`reservations.ts:147–185`) returns:
```typescript
available_capacity: Math.max(0, tenant.max_covers - concurrent_guests)
```

This correctly answers "how many more guest-spots are free at this time slot?" The endpoint also returns `max_guests` in the response body so callers can apply the per-party limit on their end.

The model is correct. `max_covers` is the right field for concurrent capacity. ✓

---

## Atomic INSERT SQL — time-window math

**Status: CORRECT**

The capacity guard in `POST /api/reservations` (`reservations.ts:299–306`):

```sql
AND (? - (CAST(SUBSTR(reservation_time, 1, 2) AS INTEGER) * 60 +
     CAST(SUBSTR(reservation_time, 4, 2) AS INTEGER))) BETWEEN 0 AND ? - 1
```

Binds: `slotMinutes` (position 17), `concurrent_guests_time_limit` (position 18).

This expresses: `0 ≤ slotMinutes − E ≤ tl − 1`, i.e., count existing reservations starting in the window `(slotMinutes − tl, slotMinutes]`.

`calculateConcurrentGuests` in `src/utils/slots.ts:26–31` expresses the same range:
```typescript
rMin <= slotMinutes && slotMinutes < rMin + timeLimitMinutes
// ↔ slotMinutes − tl < rMin ≤ slotMinutes
```

At integer-minute resolution the two conditions are equivalent. The boundary at `E = slotMinutes − tl` (exactly) is correctly excluded by both.

The bind-parameter order in `reservations.ts:308–317` matches the 20 SQL placeholders exactly. ✓

The "backward only" design (only counts existing bookings that started before the new booking) is intentional and correct: a future booking at E > S hasn't arrived yet at time S, so it doesn't contribute to occupancy at S. It will be subject to its own capacity check when it is placed.

---

## M-2 — `reservation_date` / `reservation_time` accept semantically invalid values

**Status: ✅ FIXED (2026-06-16)**

`reservation_date` in `schema.ts` now chains `.refine(v => !isNaN(new Date(v).getTime()), ...)` after the regex — rejects `"2026-99-99"`, `"2026-02-30"`, etc. `reservation_time` regex tightened to `/^([01]\d|2[0-3]):[0-5]\d$/` — rejects `"99:99"`. Same fix applied to `CreateAdminReservationSchema` in `admin.ts`.

---

## M-3 — No past-date prevention on public POST

**Status: ✅ FIXED (2026-06-16)**

`CreateReservationSchema` in `schema.ts` now has a `.superRefine()` that rejects `reservation_date` values before today's ISO date string. Admin POST intentionally not restricted (admins may record walk-ins).

---

## M-8 — Opening-hours PUT allows duplicate `day_of_week` values

**Status: ✅ FIXED (2026-06-16)**

`UpsertOpeningHoursSchema` in `schema.ts` now chains `.refine(rows => new Set(rows.map(r => r.day_of_week)).size === rows.length, ...)` — rejects payloads with duplicate `day_of_week` entries before they reach the DB.

---

## M-10 — No upper bound on `guests` in public POST

**Status: ✅ FIXED (2026-06-16)**

`max_guests` added to the tenant SELECT in `POST /api/reservations`. Guard enforced: `if (tenant.max_guests > 0 && data.guests > tenant.max_guests) return 422`. Now consistent with PATCH handler. See also C-5 / NEW-4 in production-readiness-2.md.

---

## M-17 — Tenant PATCH returns 200 for non-existent ID

**Status: ✅ FIXED (2026-06-16)**

`tenants.ts` PATCH handler now captures the UPDATE result and checks `result.meta.changes === 0 → 404`. Consistent with the DELETE handler.

---

## M-5 — Schema drift between `schema.sql` and migrations

**Status: ✅ FIXED (2026-06-16)**

`schema.sql` `Tenants` table `created_date` and `modified_date` columns now use `DEFAULT NULL` — matching the production migration state from `migrations/0003_tenants_dates.sql`.

---

## New Findings

### N-1 — Midnight-crossing opening-hours check (M-12 variant, still open)

**Status: ✅ FIXED (2026-06-16)**

Opening hours check in `reservations.ts` now converts both sides to integer minutes via `toMinutes()` (imported from `slots.ts`) and applies midnight-crossing logic: when `closeMin <= openMin`, the valid window wraps around midnight. Both `blockedDateRows` time-range comparisons in the `/blocked-times` handler were also updated to use `toMinutes()` with the same midnight-crossing logic.

---

### N-2 — `BlockDateBodySchema` allows unpaired `start_time`/`end_time`

**Status: ✅ FIXED (2026-06-16)**

`BlockDateBodySchema` in `blocked-dates.ts` now has a `.refine()` enforcing `(d.start_time == null) === (d.end_time == null)` — rejects payloads with only one of the two fields.

---

### N-3 — `DELETE /api/admin/blocked-dates/date/:date` removes timed blocks indiscriminately (M-9 still open)

**Status: ✅ FIXED (2026-06-16)**

`DELETE /date/:date` now appends `AND start_time IS NULL` to the DELETE query — only full-day blocks are removed. Timed partial blocks must be removed via `DELETE /:id`. Also now returns 404 when `meta.changes === 0` (no full-day block found for the date).

---

### N-4 — Dead early-return guard in `tenants.ts` PATCH

**Status: ✅ FIXED (2026-06-16)**

Empty-body guard now checks `Object.keys(body).length` (before `modified_date` is merged in) rather than `Object.keys(data).length`. The guard is now reachable and returns 400 correctly for empty-body PATCH requests.

---

### N-5 — `PATCH /api/reservations` capacity check is non-atomic (TOCTOU race)

**Status: ✅ FIXED (2026-06-16)**

When `guests`, `reservation_date`, or `reservation_time` is being changed, the UPDATE now uses an atomic `UPDATE … SET … WHERE id = ? AND (capacity subquery)` pattern — identical in structure to the POST atomic INSERT. If `meta.changes === 0`, capacity was exceeded and 422 is returned. Simple non-capacity-affecting PATCHes still use the plain `UPDATE … WHERE id = ?`.

---

## Summary Table

| Issue | File | Line(s) | Status |
|---|---|---|---|
| H-11: Admin POST bypasses all checks | `admin.ts` | 71–104 | ✅ Fixed 2026-06-16 |
| H-14: Capacity model (`max_covers`) | `reservations.ts` | 174 | ✅ Resolved |
| Atomic INSERT time-window math | `reservations.ts` | 299–306 | ✅ Correct |
| M-2: Invalid dates/times accepted | `schema.ts` | 35–36 | ✅ Fixed 2026-06-16 |
| M-3: Past-date bookings accepted | `schema.ts` / `reservations.ts` | 43–47 | ✅ Fixed 2026-06-16 |
| M-5: Schema drift (Tenants.created_date) | `schema.sql` / migration 0003 | — | ✅ Fixed 2026-06-16 |
| M-8: Duplicate day_of_week in PUT | `schema.ts` | 90–99 | ✅ Fixed 2026-06-16 |
| M-10: No max_guests check in POST | `reservations.ts` | 240–242 | ✅ Fixed 2026-06-16 |
| M-12: Midnight-crossing time compare | `reservations.ts` | 274, 116, 129 | ✅ Fixed 2026-06-16 |
| M-17: Tenant PATCH silent 200 for 404 | `tenants.ts` | 91–95 | ✅ Fixed 2026-06-16 |
| M-9: DELETE /date/:date wipes timed blocks | `blocked-dates.ts` | 72–82 | ✅ Fixed 2026-06-16 |
| N-2: Unpaired start_time/end_time blocks | `blocked-dates.ts` | 6–11 | ✅ Fixed 2026-06-16 |
| N-4: Dead early-return in PATCH | `tenants.ts` | 82–84 | ✅ Fixed 2026-06-16 |
| N-5: Non-atomic PATCH capacity check | `reservations.ts` | 431–447 | ✅ Fixed 2026-06-16 |
