# Neela QA — Test Coverage Gap Report (Second Review)
**Date:** 2026-06-15  
**Reviewer:** Neela (QA Engineer)  
**Scope:** Post-fix coverage audit against resolved issues from the first production-readiness review.

---

## 🚨 P0 — TEST INFRASTRUCTURE COMPLETELY BROKEN

**All integration tests fail with `D1_ERROR: no such table: Reservations: SQLITE_ERROR`.**

The `@cloudflare/vitest-pool-workers` plugin provisions a fresh in-memory D1 database for each test run, but `vitest.config.mts` does not instruct it to apply migrations. The D1 database config in `wrangler.jsonc` has `migrations_dir: ./migrations`, but the vitest plugin requires an explicit `apply_migrations: true` or equivalent option at the pool level. As a result, every test file that touches a DB table is failing.

**Why it matters:** The entire integration test suite is non-functional. Any CI gate reporting passes is doing so falsely (e.g., treating exit code 0 from vitest as success even though all assertions errored). James cannot rely on _any_ of these tests as a regression safety net until this is fixed.

**Fix:**  
In `vitest.config.mts`, set `apply_migrations: true` on the D1 binding inside `cloudflareTest()`:

```ts
cloudflareTest({
  wrangler: { configPath: './wrangler.jsonc' },
  d1Databases: {
    maximum_bookings_db: {
      applyMigrations: true,
    },
  },
})
```

Refer to: https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/

---

## P1 — Critical Coverage Gaps

### GAP-01: `calculateConcurrentGuests` has no unit tests

**What is untested:** The core booking-logic function in `src/utils/slots.ts` — `calculateConcurrentGuests(slotTime, reservations, timeLimitMinutes)` — has zero unit tests. The frontend util file (`src/frontend/shared/utils/slots.ts`) has a test suite (`slots.test.ts`), but that only covers frontend functions (`generateSlots`, `getSlotsForDate`, etc.). The backend `calculateConcurrentGuests` is tested only indirectly via integration tests in `test/index.spec.ts:253–265`.

**Why it matters:** The directional window bug (`Math.abs` vs correct `rMin <= slotMinutes && slotMinutes < rMin + timeLimitMinutes`) was the most critical regression in the first report. Without a unit test that directly exercises `calculateConcurrentGuests`, the fix could be silently reverted by a refactor and the integration test might not catch it if the test data is subtly wrong.

**Test that should exist:**
```
it('does NOT count a future booking as concurrent (directional: rMin > slotMinutes)', () => {
  // booking at 14:50 is 110 min AFTER slot at 13:00 — must not be counted
  expect(calculateConcurrentGuests('13:00', [{ reservation_time: '14:50', guests: 8 }], 120)).toBe(0);
});

it('counts a booking that starts exactly at slotTime', () => {
  expect(calculateConcurrentGuests('14:00', [{ reservation_time: '14:00', guests: 4 }], 120)).toBe(4);
});

it('counts a booking that starts before slotTime within the window', () => {
  // booking at 12:30, slot at 14:00 — 90 min gap, within 120 min limit
  expect(calculateConcurrentGuests('14:00', [{ reservation_time: '12:30', guests: 6 }], 120)).toBe(6);
});

it('does NOT count a booking that started exactly at the time limit boundary', () => {
  // booking at 12:00, slot at 14:00 — exactly 120 min, which is NOT < timeLimitMinutes
  expect(calculateConcurrentGuests('14:00', [{ reservation_time: '12:00', guests: 5 }], 120)).toBe(0);
});
```

---

### GAP-02: `/api/availability` tests check the wrong response shape

**What is untested (correctly):** Three tests exist for `GET /api/reservations/availability` in `test/index.spec.ts:329–350`, but they check `body.booked` and `body.remaining`. The actual endpoint (`src/routes/reservations.ts:147–185`) returns:
```json
{ "date": "...", "max_covers": 20, "max_guests": 50, "time_limit_minutes": 120, "slots": [...] }
```
There is no `booked` or `remaining` field. The assertions `expect(body.booked).toBe(5)` and `expect(body.remaining).toBe(15)` will silently fail (comparing `undefined` to a number). The "returns 400 when params are missing" test is the only one that could be meaningfully passing.

**Why it matters:** There is no effective test coverage for the availability endpoint's business logic — per-slot concurrent guest counts, capacity calculations, and tenant validation. A regression could silently change what data the booking widget uses to decide whether a slot is bookable.

**Tests that should exist:**
```
it('returns per-slot concurrent counts — slot with a booking shows correct concurrent_guests')
it('returns available_capacity = 0 for a slot that is at capacity')
it('returns 404 for unknown tenant_id')
it('returns 400 when date param is missing')
```

---

### GAP-03: Public PATCH capacity enforcement (H-10) completely untested

**What is untested:** The `PATCH /api/reservations/:id` endpoint was updated (H-10) to:
1. Require `?email=` and `?token=` query parameters (HMAC verification)
2. Re-validate concurrent-guest capacity before applying changes

The existing PATCH tests in `test/index.spec.ts:269–309` send requests without `email` or `token` query params. Per the current source (`reservations.ts:401`):
```ts
if (!existing || !email || existing.email.toLowerCase() !== email.toLowerCase()) {
  return c.json({ error: 'Reservation not found' }, 404);
}
```
These tests would return `404`, not `200`. They are stale and do not test the current route behaviour.

**Why it matters:** The capacity-enforcement logic on PATCH is completely unverified. A customer who holds the only remaining spot could PATCH their booking to add 10 more guests with impunity, blowing past `max_covers`.

**Tests that should exist:**
```
it('PATCH returns 404 when email param is missing')
it('PATCH returns 404 when token param is invalid')
it('PATCH returns 422 when new guest count would exceed max_covers')
it('PATCH allows reducing guest count even when venue is at capacity')
it('PATCH capacity check excludes the reservation being updated (self-exclusion)')
```

---

### GAP-04: Manage token utility has no tests

**What is untested:** `src/utils/manageToken.ts` exports three functions: `generateManageToken`, `hashManageToken`, and `verifyManageToken`. There are zero tests anywhere for these functions.

**Why it matters:** The manage token is the sole authentication mechanism for customer-facing PATCH and DELETE. If `verifyManageToken` has an implementation bug (e.g., it returns `true` for any token when `storedHash` is null, or it accepts a token bound to a different email), the cancel/amend flows have no security. The current implementation checks `expectedToken === presentedToken && presentedHash === storedHash` — a subtly wrong comparison could accept forged tokens.

**Tests that should exist:**
```
it('generateManageToken produces the same token for the same inputs (deterministic)')
it('generateManageToken produces different tokens for different reservationId')
it('generateManageToken produces different tokens for different email (case-insensitive normalisation)')
it('hashManageToken produces a hex string of 64 characters')
it('verifyManageToken returns true for a valid token/hash pair')
it('verifyManageToken returns false when token does not match')
it('verifyManageToken returns false when presentedToken is empty string')
it('verifyManageToken returns false when storedHash is empty string or null')
```

---

### GAP-05: Admin `POST /api/admin/reservations` completely untested

**What is untested:** `admin.ts:71–104` implements `POST /api/admin/reservations`, which lets an authenticated admin create a reservation directly. The admin.spec.ts file has no test for this endpoint at all — no happy-path test, no input validation test, no auth gate test.

**Why it matters:** The admin POST route bypasses the public route's capacity enforcement and opening-hours enforcement. An admin can create a booking at 03:00 or over the venue capacity without any check. If a future refactor inadvertently breaks the auth middleware (`admin.use('*', adminAuth)`), unauthenticated parties could insert arbitrary reservations.

**Tests that should exist:**
```
it('POST /api/admin/reservations returns 401 without auth token')
it('POST /api/admin/reservations creates a reservation and returns 201 with id')
it('POST /api/admin/reservations returns 400 when required fields are missing')
it('POST /api/admin/reservations scopes the new reservation to the authenticated tenant (tenant_id from JWT, not body)')
```

---

### GAP-06: Past-date prevention — no enforcement, no test

**What is untested:** Neither `CreateReservationSchema` nor the POST route handler perform any server-side check that `reservation_date` is in the future. The schema validates only that the format matches `YYYY-MM-DD`. A customer can POST a reservation for yesterday and receive 201.

**Why it matters:** Past-date bookings corrupt reporting, affect capacity calculations for historic dates, and produce nonsensical confirmation emails. The public POST route is the entry point for all customer bookings.

**Fix needed:** Add `.refine(d => d >= new Date().toISOString().slice(0, 10), ...)` or an equivalent server-side check.

**Tests that should exist:**
```
it('POST /api/reservations returns 422 when reservation_date is yesterday')
it('POST /api/reservations returns 422 when reservation_date is a past year')
it('POST /api/reservations accepts a reservation_date of today (boundary)')
```

---

### GAP-07: Opening-hours time enforcement untested at the API level

**What is untested:** The server-side opening-hours time check exists (`reservations.ts:273–277`):
```ts
if (data.reservation_time < openingHours.open_time || data.reservation_time >= openingHours.close_time) {
  return c.json({ error: 'Bookings are not available for this time' }, 422);
}
```
But no integration test exercises this code path. The existing opening-hours tests cover closed days (full day) and `blocked-times` endpoint behaviour — not a POST attempt at an out-of-hours time on an otherwise open day.

**Why it matters:** If the string-comparison `data.reservation_time < openingHours.open_time` ever breaks (e.g., due to a format change from `HH:MM` to `H:MM`), customers could book at midnight with no error returned.

**Tests that should exist:**
```
it('POST /api/reservations returns 422 when reservation_time is before open_time (e.g. 03:00 when open at 12:00)')
it('POST /api/reservations returns 422 when reservation_time equals close_time (boundary: 22:00 when close is 22:00)')
it('POST /api/reservations returns 201 when reservation_time is exactly at open_time')
```

---

### GAP-08: Atomic INSERT race condition — no concurrency test

**What is untested:** The POST route uses an atomic `INSERT ... WHERE (SELECT COALESCE(SUM(...))) + guests <= max_covers` pattern to prevent double-booking. There is no test that issues two simultaneous POST requests targeting the same slot when `capacity = 1`, and asserts that exactly one succeeds with 201 and the other returns 422.

**Why it matters:** The whole point of the atomic insert was to close race condition C-6 from the first report. Without a test, a future change that splits the check back into SELECT-then-INSERT could silently reintroduce the race.

**Test that should exist:**
```
it('two simultaneous POSTs for capacity=1 — exactly one succeeds with 201 and one gets 422', async () => {
  // seed tenant with max_covers=1
  // fire two concurrent requests with Promise.all([post, post])
  const results = await Promise.all([post(), post()]);
  const statuses = results.map(r => r.status).sort();
  expect(statuses).toEqual([201, 422]);
})
```

---

### GAP-09: Cross-tenant isolation for public reservation endpoints

**What is untested:** The public `GET /api/reservations/:id?email=` endpoint returns reservation details to anyone who knows the UUID and provides the correct email. There is no test that:
- Requests a reservation belonging to tenant A using a UUID that is valid but the email belongs to tenant B
- Verifies that tenant B's email cannot be used to look up tenant A's reservation (they share no data relationship, but the query is global: `SELECT * FROM Reservations WHERE id = ?`)

**Why it matters:** Reservations from different tenants all live in the same `Reservations` table. A customer of tenant B who guesses a UUID from tenant A and provides _their own_ email would be rejected (email mismatch), but there is no test asserting this. More importantly, if the email check were accidentally removed, cross-tenant data would leak.

**Tests that should exist:**
```
it('GET /api/reservations/:id with correct UUID but wrong-tenant email returns 404 (not 403 — do not reveal existence)')
it('DELETE /api/reservations/:id?email=&token= with token bound to a different reservation returns 404')
```

---

### GAP-10: Stale tests in `reservations-cancel.test.ts` and `email-integration.spec.ts`

**What is wrong:** Several test files were written before the manage-token flow was added to PATCH/DELETE/GET. These tests call the endpoints without `?email=` and `?token=` params and expect 200/404 responses based on the old unauthenticated API:

| File | Test | Expected | Current behaviour |
|------|------|----------|-------------------|
| `reservations-cancel.test.ts:65` | GET /:id (no email) | 200 | 404 (email required) |
| `reservations-cancel.test.ts:107` | DELETE /:id (no email/token) | 200 | 404 (email required) |
| `email-integration.spec.ts:92` | PATCH /:id (no email/token) | 200 | 404 (email required) |
| `email-integration.spec.ts:111` | DELETE /:id (no email/token) | 200 | 404 (email required) |
| `index.spec.ts:270` | PATCH /:id (no email/token) | 200 | 404 (email required) |
| `index.spec.ts:314` | DELETE /:id (no email/token) | 200 | 200 ← actually correct? |

These tests will not catch genuine regressions; they will _pass_ for the wrong reason (404 matching the "unknown reservation" case) or _fail_ outright. They need to be updated to seed a `manage_token_hash` and supply valid `email` and `token` params.

---

## Summary Matrix

| Gap | Severity | File(s) affected | Status |
|-----|----------|-----------------|--------|
| P0: Migrations not applied in test env | **CRITICAL** | `vitest.config.mts` | All integration tests failing |
| GAP-01: `calculateConcurrentGuests` unit tests | High | `src/utils/slots.ts` | No unit tests exist |
| GAP-02: `/api/availability` wrong response shape | High | `test/index.spec.ts:329` | Tests check non-existent fields |
| GAP-03: PATCH capacity + manage token auth | High | `test/index.spec.ts:269` | Stale tests; H-10 untested |
| GAP-04: Manage token utility untested | High | `src/utils/manageToken.ts` | Zero tests |
| GAP-05: Admin POST /reservations untested | Medium | `test/admin.spec.ts` | Route exists; no tests |
| GAP-06: Past-date prevention missing | Medium | `src/routes/reservations.ts` | No enforcement, no test |
| GAP-07: Opening-hours time check untested | Medium | `test/index.spec.ts` | Logic exists; no API test |
| GAP-08: Atomic INSERT race condition | Medium | `test/index.spec.ts` | No concurrency test |
| GAP-09: Cross-tenant isolation (public) | Medium | `test/reservations-cancel.test.ts` | No cross-tenant test |
| GAP-10: Stale cancel/email tests | Medium | multiple | Will fail or pass vacuously once DB fixed |

---

*Report generated by Neela, QA Engineer. Next review gated on: P0 infrastructure fix + GAP-01 through GAP-04 addressed.*
