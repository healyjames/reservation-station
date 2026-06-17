# Production Readiness Review — Round 2

**Reviewer:** Han (Technical Lead)
**Date:** 2026-06-15
**Scope:** Maximum Bookings — second production-readiness review
**Verdict: ✅ GO — all blockers resolved (updated 2026-06-16)**

---

## 1. Critical Issues (C-1 through C-7)

### C-1 — GET /api/reservations publicly dumped all customer PII
**Status: ✅ FIXED**
`src/routes/reservations.ts:187` — `reservations.get('/', adminAuth, async (c) =>`. `adminAuth` middleware is applied before the handler. Only authenticated admin JWT holders can list reservations for their tenant.

---

### C-2 — GET/PATCH/DELETE /api/reservations/:id unauthenticated
**Status: ✅ FIXED**
- `GET /:id` (`reservations.ts:209`) — requires `?email=` query param; rejects with 404 if email is absent or does not case-insensitively match the stored value. `manage_token_hash` is stripped before the response (`reservations.ts:223`).
- `PATCH /:id` (`reservations.ts:375`) — requires both `?email=` match (`reservations.ts:401`) and a valid HMAC manage token (`reservations.ts:405–411`).
- `DELETE /:id` (`reservations.ts:531`) — same email + HMAC token gate (`reservations.ts:541–551`).

Note: GET still exposes full PII (name, telephone, dietary) to anyone holding an email address. Given the manage-booking UX, this is a deliberate trade-off. Acceptable for the use-case, but email is passed as a URL query parameter and will appear in server-side access logs and browser history. Should be moved to a header or POST body longer-term.

---

### C-3 — Tenant CRUD completely unauthenticated
**Status: ✅ FIXED**
`src/routes/tenants.ts:8,41,72,107` — `superAdminAuth` applied to GET /, POST /, PATCH /:id, DELETE /:id. `GET /:id` intentionally remains public, returning an explicit public column allowlist (`tenants.ts:19`) that excludes `contact_email`, `created_date`, and `modified_date`.

---

### C-4 — ENVIRONMENT=development committed to wrangler.jsonc
**Status: ✅ FIXED**
`wrangler.jsonc:55` — `"ENVIRONMENT": "production"`. CORS now defaults to `PROD_ORIGINS` only. DEV origins are only included when `ENVIRONMENT === 'development'` (`app.ts:17–19`).

---

### C-5 — max_guests concurrent check missing from POST /api/reservations
**Status: ✅ FIXED**
`max_guests` added to the tenant SELECT query (`reservations.ts:240`). Guard added after tenant status check: `if (tenant.max_guests > 0 && data.guests > tenant.max_guests) return 422`. Consistent with PATCH handler. Fixed 2026-06-16.

---

### C-6 — Race condition on daily capacity check (non-atomic)
**Status: ✅ FIXED**
The SELECT-then-INSERT race is eliminated. The concurrent capacity re-evaluation lives inside the INSERT's WHERE clause (`reservations.ts:299–306`), meaning no concurrent request can sneak in between a capacity check and the write.

---

### C-7 — PATCH missing from CORS allowMethods
**Status: ✅ FIXED**
`src/app.ts:23` — `allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']`.

---

## 2. High Issues (H-1 through H-16)

### H-1 — Math.abs directional bug in slots.ts
**Status: ✅ FIXED** (per coordinator; not re-examined in this file set)

### H-2 — Missing composite index on Reservations(tenant_id, reservation_date)
**Status: ✅ FIXED**
`src/db/schema.sql:53` — `CREATE INDEX idx_reservations_tenant_date ON Reservations(tenant_id, reservation_date)`
`migrations/0007_reservations_tenant_date_index.sql` also present.

### H-3 — UNIQUE constraint missing on tenant_code
**Status: ✅ FIXED**
`src/db/schema.sql:55` — `CREATE UNIQUE INDEX idx_tenants_code ON Tenants(tenant_code)`.

### H-4 — Duplicate booking constraint missing
**Status: ✅ FIXED**
`src/db/schema.sql:54` — `CREATE UNIQUE INDEX idx_reservations_unique_booking ON Reservations(tenant_id, email, reservation_date, reservation_time)`. UNIQUE constraint violation is caught and returns a 409 (`reservations.ts:320–322`).

### H-5 — localStorage → sessionStorage
**Status: ✅ FIXED**
`src/frontend/shared/hooks/useAuth.ts` uses `sessionStorage` throughout (lines 24, 34–35, 45, 64–65, 80–81).

### H-6 — Manage token required for PATCH/DELETE
**Status: ✅ FIXED** (see C-2 above)

### H-7 — superAdminAuth missing from GET /api/tenants
**Status: ✅ FIXED**
`src/routes/tenants.ts:8` — `tenants.get('/', superAdminAuth, ...)`.

### H-8 — Opening hours check missing from POST /api/reservations
**Status: ✅ FIXED**
`reservations.ts:263–278` — day-of-week lookup, is_closed check, and open_time/close_time bound check are all present.

### H-9 — Tenant status check missing from POST /api/reservations
**Status: ✅ FIXED**
`reservations.ts:249–251` — `if (tenant.status !== 'active')` returns 422.

### H-10 — Capacity check missing from PATCH /api/reservations/:id
**Status: ✅ FIXED**
`reservations.ts:416–448` — capacity is re-evaluated against the effective date/time/guests (excluding the current reservation), with max_guests check at line 422 and max_covers concurrent check at line 427.

### H-11 — Admin POST /api/admin/reservations does bare INSERT
**Status: ✅ FIXED**
`admin.ts` now fetches `status, max_guests, max_covers, concurrent_guests_time_limit` from Tenants before INSERT. Checks enforced in order: tenant status → max_guests party size → full-day blocked date → atomic INSERT with concurrent capacity subquery in WHERE clause. Opening hours intentionally not enforced (admins may legitimately create bookings outside hours). Fixed 2026-06-16.

### H-12 — Admin DELETE not tenant-scoped
**Status: ✅ FIXED**
`admin.ts:147–150` — `DELETE FROM Reservations WHERE id = ? AND tenant_id = ?`. Tenant-scoped.

### H-13 — blockedDatesError signal not exposed / no retry button
**Status: ✅ FIXED**
`src/frontend/shared/hooks/useAvailability.ts:9,31,37` — `blockedDatesError` signal is exposed and set on fetch failure.

### H-14 — /api/availability uses wrong capacity field
**Status: ✅ FIXED**
`reservations.ts:174` — `available_capacity: Math.max(0, tenant.max_covers - concurrent_guests)`. Both `/availability` and `/blocked-times` now consistently use `max_covers`.

### H-15 — isFetchingDates does not disable calendar
**Status: ✅ FIXED**
`useAvailability.ts:27,38` — `isFetchingDates` is set true/false around the fetch, exposed to callers.

### H-16 — handleDateSelect has no AbortController or request ID guard
**Status: ✅ FIXED**
`useAvailability.ts:fetchBlockedTimes` and `useManageBooking.ts:fetchBlockedTimesForDate` both now hold a `blockedTimesAbortController` variable; each new call aborts any in-flight request before starting a new one, with `AbortError` silently ignored. Additionally, `step.value = 'form-step1'` in `BookingApp.tsx` is now set immediately before the `await`, so the UI advances instantly rather than after the network round-trip. Fixed 2026-06-16.

---

## 3. New Issues

### NEW-1 — PII console.log in production (HIGH — BLOCKER)
**Status: ✅ FIXED**
`console.log('reservationId:', reservationId, 'bookingEmail:', bookingEmail)` deleted from `useManageBooking.ts`. Fixed 2026-06-16.

---

### NEW-2 — verifyManageToken uses `===` string comparison (MEDIUM)
**Status: ✅ FIXED**
`verifyManageToken` in `src/utils/manageToken.ts` now re-derives both hashes and compares both via a constant-time XOR function (`timingSafeEqual`) instead of `===`. Fixed 2026-06-16.

---

### NEW-3 — superAdminAuth uses `!==` string comparison (MEDIUM)
**Status: ✅ FIXED**
`src/middleware/superAdminAuth.ts` now uses a constant-time XOR comparison (`timingSafeEqual`) to compare the submitted key against `SUPER_ADMIN_KEY`. Fixed 2026-06-16.

---

### NEW-4 — POST /api/reservations does not enforce max_guests server-side (MEDIUM — BLOCKER)
**Status: ✅ FIXED**
`max_guests` added to the tenant SELECT query in `POST /api/reservations`. Guard enforced after tenant status check. See C-5. Fixed 2026-06-16.

---

### NEW-5 — CORS allows only the workers.dev origin (HIGH — BLOCKER if widget embedding is a launch feature)
**Status: ✅ FIXED**
CORS now allows any `https://` origin in production (`app.ts`). Rationale: the widget must be embeddable on any restaurant website; the security boundary is enforced by credentials (admin JWT, manage token), not by origin-checking. Safe for this use-case (Option C). Fixed 2026-06-16.

---

### NEW-6 — Success screen shows no booking reference or manage link (MEDIUM)
**Status: ✅ FIXED**
`useBookingForm.submitBooking` now parses the POST response body and passes `body.id` to `onSuccess`. `BookingApp` stores the ref in a signal and passes it to `<Success>`. The success screen now displays the booking reference, guidance to use the confirmation email link to manage/cancel, and a "Book Another Table" button. Fixed 2026-06-16.

---

## 4. Go / No-Go Recommendation

### ✅ GO — all blockers resolved (updated 2026-06-16)

All four original blockers and all deferred post-launch items have been addressed:

| # | Issue | Resolution |
|---|-------|-----------|
| B1 | PII `console.log` | Removed |
| B2 | H-11: Admin POST bare INSERT | Full capacity gate added (status, max_guests, blocked dates, atomic INSERT) |
| B3 | POST missing `max_guests` validation | max_guests added to tenant SELECT + guard enforced |
| B4 | CORS single origin | Now allows any `https://` origin in production |
| NEW-2 | verifyManageToken timing | Constant-time XOR comparison |
| NEW-3 | superAdminAuth timing | Constant-time XOR comparison |
| H-16 | AbortController on date selection | AbortController in both hooks; step advances before await |
| NEW-6 | Success screen missing booking ref | bookingRef surfaced, manage guidance added, Book Another Table button added |

---

## 5. Minimum Blocker List

**All blockers resolved. See §4.**

---

## 6. Deferred (Post-Launch Backlog)

| Issue | Status |
|-------|--------|
| NEW-2: verifyManageToken timing side-channel | ✅ Fixed — constant-time XOR comparison |
| NEW-3: superAdminAuth timing side-channel | ✅ Fixed — constant-time XOR comparison |
| H-16: No AbortController on date selection | ✅ Fixed — AbortController in both hooks |
| NEW-6: Success screen shows no booking reference | ✅ Fixed — bookingRef surfaced on success screen |
| Email as URL query param in GET /:id | ⚠️ Still present — will appear in access logs; consider POST or header approach post-launch |

---

*Han — Technical Lead*
*Review completed against files inspected on 2026-06-15*
