# Neela - History

## Core Context

Tester on the Maximum Bookings project. Writes Vitest tests, reviews implementations, quality gate.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph

## Key File Paths

- `test/` - test files
- `vitest.config.mts` - Vitest config

## Learnings

- **Admin Dashboard auth + API tests (Phase 8):** Wrote `test/auth.spec.ts` and `test/admin.spec.ts` from spec before Sean's implementation.
  - `hashPassword` imported from `../../src/utils/auth` to generate seeds at test runtime — avoids pre-computing PBKDF2 hashes
  - `signJWT` imported from same module for the expired-token test case (passes `-1` as `expiresInSeconds`)
  - `getAuthToken()` helper calls the login endpoint to get real tokens — preferred over crafting JWTs manually
  - JWT payload decoded in tests via `atob(payloadB64)` without verifying signature — valid for checking claims in tests
  - Tenant isolation for PATCH/DELETE: spec says return 404 (not 403) to avoid revealing the resource exists
  - Rate limiting: test both "10 failures → locks account" (via repeated HTTP calls) and "lock expired → login succeeds" (via DB seed with past locked_until)
  - Each test file uses distinct UUID constants so they don't clash with each other or the existing index.spec.ts tests
  - `PATCH /api/admin/me` immutability test: send `id` and `tenant_id` in body, assert they were silently ignored
  - Assumption documented in test: omitting `date` from `GET /api/admin/reservations` returns all own-tenant bookings (200) — consistent with public endpoint; if Sean changes this to 400, the test comment explains how to flip it

- **Sean's phase 1+2 complete (2026-04-05):** All auth and admin route implementations are in place. `test/auth.spec.ts` and `test/admin.spec.ts` should now be runnable. Sean added the `expiresInSeconds` optional parameter to `signJWT` as required by the test suite. The `AdminUsers` migration (`0002`) is applied.
- **API logging strategy (2026-04-06):** Business-rule rejections (422) and expected 404s are silent — not errors. Only D1 write failures and unexpected missing tenants trigger `console.error`. Do not add test assertions against log output for these silent paths.
- **No code comments directive (2026-04-07):** James directed no inline comments in code unless genuinely necessary. Applies to test files too.

### Original Learnings

- Project kickoff: 2026-04-01
- Using Vitest (already configured)
- Key edge cases for booking systems: double-booking, past dates, fully-booked slots, invalid party sizes
- **blocked-times endpoint tests (2026-04-01):** Added comprehensive test coverage for concurrent guest limit logic. Key patterns tested:
  - Parameter validation (missing tenant_id, date, guests → 400)
  - Unknown tenant → 404
  - Empty state (no reservations → empty blocked_times array)
  - Special case: max_guests=0 means no concurrent limit (always returns empty blocked_times)
  - Boundary testing: slots blocked when concurrent_guests + requested_guests > max_guests
  - Time window validation: only slots within concurrent_guests_time_limit are affected
  - Used far-future dates (2099-08-01) to avoid same-day block interference
  - Test pattern: seed tenant with specific max_guests/time_limit, seed reservation, verify blocked slots match expectation
- **Oak Tavern scenario tests (2026-04-01):** Added a new `describe('GET /api/reservations/blocked-times - Oak Tavern scenario')` block with 4 tests modelling a busy lunch scenario using `TENANT_ID`, `max_guests: 10`, `concurrent_guests_time_limit: 120`, date `2099-06-15`:
  1. Lunch cluster (13:00/4g + 13:30/4g) with `guests=3` → 13:00, 13:30, 14:00 all blocked (8+3=11 > 10)
  2. Same cluster with `guests=1` → no slots blocked (8+1=9 ≤ 10)
  3. Same cluster with `guests=3` → 16:00, 19:00, 20:00 NOT blocked (≥120 min from all bookings)
  4. Three bookings (13:00/4g + 13:30/3g + 14:00/2g = 9 concurrent): `guests=1` not blocked (9+1=10), `guests=2` blocked (9+2=11 > 10)
  - Used inline ID literals `'00000000-0000-4000-8000-000000000020'` and `'00000000-0000-4000-8000-000000000021'` for extra reservations
