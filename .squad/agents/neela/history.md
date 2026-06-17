# Neela - History

## Core Context

Tester on the Maximum Bookings project. Writes Vitest tests, reviews implementations, quality gate.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph

## Key File Paths

- `test/` - test files
- `vitest.config.mts` - Vitest config

## Learnings

- **Concurrent capacity POST tests (2026-06-12):** Updated `test/index.spec.ts` POST `/api/reservations` coverage to match the concurrent-window `max_covers` rule instead of the removed daily-sum rule.
  - Replaced the old remaining-covers assertions with four scenarios: non-overlapping same-day windows, concurrent overflow on a small-capacity tenant, exact 120-minute boundary acceptance, and unlimited capacity when `max_covers = 0`
  - Used `TENANT_ID_2` with `tenant_code: 'small-venue'` / `'unlimited-venue'` for the custom-capacity cases so the default seeded tenant (`max_covers: 20`) stays untouched
  - Unlimited-capacity coverage now seeds multiple same-time reservations before POSTing another large party, proving the guard is skipped when `max_covers` is zero
  - Test execution was not run because the session rejected test commands with `No, ignore tests`

- **Email notification test suite (Phase 3):** Wrote `test/email-util.spec.ts`, `test/email-templates.spec.ts`, and `test/email-integration.spec.ts` ahead of Sean's implementation.
  - `email-util.spec.ts` uses `vi.stubGlobal('fetch', vi.fn())` in a module-level variable captured in `beforeEach` for clean per-test mock control — avoids casting `vi.mocked(fetch)` with the global Workers fetch type
  - `email-templates.spec.ts` is pure TypeScript (no `cloudflare:workers` import) — all 6 template builders tested with identical shape; customer templates get an extra null-dietary test; tenant templates omit it (tenant data always has dietary as string | null but template must not render 'null')
  - `null` dietary requirements test uses `not.toContain('null')` — this constrains Sean to use a fallback string (None / N/A etc.) not bare template interpolation
  - Integration fire-and-forget tests: stub fetch to throw inside the test body (not in a shared `beforeEach`) so only the tests that need it get the stub; `afterEach` always calls `vi.unstubAllGlobals()` to restore
  - Integration tests do NOT assert that email calls were made — only that HTTP response codes are unaffected by email failures; call-count assertions deferred until implementation lands
  - `seedTenantWithEmail` explicitly includes `contact_email` column in the INSERT — validates migration 0006 column is present; integration tests use TENANT_ID `000000000001` / RES_ID `000000000099` (safe since each spec runs in its own Miniflare D1 instance)
  - All 6 template functions are currently stubs returning `{ subject: '', html: '' }` — template tests will fail until Sean implements them (expected; tests define the contract)

- **Reservation cancellation API tests (2026-05-19):** Added `test/reservations-cancel.test.ts` for the cancel-page endpoints.
  - Uses UUID range `000000001401–000000001599` to avoid collisions with existing spec files
  - Seeds a far-future reservation (`2099-11-18 18:30`) with non-null `dietary_requirements` so GET assertions exercise the full response shape the cancel page needs
  - DELETE coverage asserts both success payload (`{ success: true }`) and behavior by following with GET `404 { error: 'Reservation not found' }`
  - Idempotency is explicit: second DELETE on the same UUID must return `404`, not a second success

- **Admin Dashboard auth + API tests (Phase 8):** Wrote `test/auth.spec.ts` and `test/admin.spec.ts` from spec before Sean's implementation.
  - `hashPassword` imported from `../../src/utils/auth` to generate seeds at test runtime - avoids pre-computing PBKDF2 hashes
  - `signJWT` imported from same module for the expired-token test case (passes `-1` as `expiresInSeconds`)
  - `getAuthToken()` helper calls the login endpoint to get real tokens - preferred over crafting JWTs manually
  - JWT payload decoded in tests via `atob(payloadB64)` without verifying signature - valid for checking claims in tests
  - Tenant isolation for PATCH/DELETE: spec says return 404 (not 403) to avoid revealing the resource exists
  - Rate limiting: test both "10 failures → locks account" (via repeated HTTP calls) and "lock expired → login succeeds" (via DB seed with past locked_until)
  - Each test file uses distinct UUID constants so they don't clash with each other or the existing index.spec.ts tests
  - `PATCH /api/admin/me` immutability test: send `id` and `tenant_id` in body, assert they were silently ignored
  - Assumption documented in test: omitting `date` from `GET /api/admin/reservations` returns all own-tenant bookings (200) - consistent with public endpoint; if Sean changes this to 400, the test comment explains how to flip it

- **Sean's phase 1+2 complete (2026-04-05):** All auth and admin route implementations are in place. `test/auth.spec.ts` and `test/admin.spec.ts` should now be runnable. Sean added the `expiresInSeconds` optional parameter to `signJWT` as required by the test suite. The `AdminUsers` migration (`0002`) is applied.
- **API logging strategy (2026-04-06):** Business-rule rejections (422) and expected 404s are silent - not errors. Only D1 write failures and unexpected missing tenants trigger `console.error`. Do not add test assertions against log output for these silent paths.
- **No code comments directive (2026-04-07):** James directed no inline comments in code unless genuinely necessary. Applies to test files too.

- **block_current_day integer coercion tests (2026-04-08):** Added 6 new test cases to `test/admin.spec.ts` inside the `PATCH /api/admin/me` describe block to cover the bug fix where the Zod schema rejected integer `0`/`1` for `block_current_day`. Tests cover: integer `1` → 200 + DB value `1`; integer `0` → 200 + DB value `0`; boolean `true` → 200 + DB value `1`; boolean `false` → 200 + DB value `0`; string `"yes"` → 400; out-of-range integer `2` → 400. Each successful case queries the DB directly to assert the persisted value, consistent with the existing PATCH patterns in the file. The schema fix (`z.union([z.boolean(), z.literal(0), z.literal(1)])`) must be applied in `src/db/schema.ts` for the integer and invalid-value cases to pass.

- **BlockedDates feature test suite (2026-04-15):** Created `test/blocked-dates.spec.ts` with 24 tests covering admin CRUD, public blocked-dates endpoint, blocked-times integration, and reservation creation enforcement.
  - `seedTenant` INSERT omits `block_current_day` entirely — relies on `DEFAULT FALSE` so it's forward-compatible with the migration that removes the column
  - `clearDb` wraps `DELETE FROM BlockedDates` in `.catch(() => {})` — pre-migration, the missing table silently skips; individual feature tests fail cleanly instead of every test blowing up on `beforeEach`
  - UUID range `000000000601–000000000901` used to avoid collisions with existing test files
  - `generateTimeSlots()` confirmed to return exactly 20 slots (12:00–21:30 at 30-min intervals) — `blocked_times.length === 20` assertion is grounded in source
  - Time-range block boundary: only asserting clearly inside/outside the range; the edge slot (end_time itself) is left unasserted since include/exclude semantics are Sean's call
  - DELETE tests use `expect([200, 204]).toContain(res.status)` — spec allows either
  - **Flagged** for Han + Sean: `test/index.spec.ts` and `test/admin.spec.ts` both reference `block_current_day` in seedTenant and specific test cases — these need updating after migration removes the column

- **Opening Hours feature test suite:** Created `test/opening-hours.spec.ts` with 19 tests across 5 suites: GET/PUT admin opening-hours, tenant public endpoint with opening_hours field, blocked-dates with closed day_of_week, and blocked-times with opening hours.
  - UUID range `000000001001–000000001206` plus `000000001300` for a blocked-date seed; no collision with other spec files
  - `seedOpeningHours` uses `INSERT OR REPLACE` bound to `(id, tenant_id, day_of_week, is_closed, open_time, close_time)` — mirrors the DB schema exactly
  - `clearDb` wraps both `DELETE FROM OpeningHours` and `DELETE FROM BlockedDates` in `.catch(() => {})` since both tables may not exist pre-migration
  - January 2099 chosen for blocked-dates suite: starts on Thursday (day_of_week=4); Sundays (0) fall on 5, 12, 19, 26; Mondays (1) on 6, 13, 20, 27 — deterministic day-of-week arithmetic for assertions
  - Suite 4 (blocked-dates) uses the public endpoint — no auth token needed; seeds tenants directly via `seedTenant`
  - Suite 5 (blocked-times) seeds tenant with `max_guests: 0` (unlimited) to isolate opening-hours logic from capacity logic
  - Closed-day blocked-times test verifies `blocked_times.length === 20` plus presence of boundary slots `12:00` and `21:30`
  - `makeAllOpenHours()` helper generates a 7-entry array (days 0–6, open 12:00–22:00) for PUT body construction; individual tests spread/override specific days for mutation scenarios
  - `is_closed` asserted as integer `1` from GET responses (D1 returns booleans as integers)
  - Suite 3 (tenant public endpoint) tests `opening_hours: null` when no rows exist and an array when rows are present — tests the new field that Sean needs to add to the GET /api/tenants/:id response

- **manage-booking review and test coverage (2026-05-21):** Reviewed Sean's `GET /api/tenants/:id` UUID/tenant_code change and Twinkie's `manage-booking.js`. Both approved. No blocking issues found. Key review notes: `state.view` is dead state (no functional impact); `dietary_requirements` sends `''` on clear; all fetch callsites wrapped in try/catch; full `escapeHtml()` coverage verified — no XSS vulnerabilities; minimum party size of 2 matches `booking-form.js` (consistent design). Two new test cases added to `test/index.spec.ts`: returns tenant by tenant_code; 404 for unknown tenant_code. `seedTenant` in `index.spec.ts` updated to include `tenant_code`. Extended `test/reservations-edit.test.ts` with PATCH availability scenarios: open future date (pass), full-day blocked date (reject), closed day from OpeningHours (reject), non-date field edit on valid date (pass). Test execution rejected with `No, ignore tests`.

- **Tenant CRUD auth + projection coverage (2026-06-12):** Added `test/tenants.spec.ts` for C-3 tenant protection and public projection behaviour.
  - Uses UUID range `000000002001–000000002099` to avoid collisions with existing spec files
  - `getAdminKey()` reads `(env as any).SUPER_ADMIN_KEY` so the suite follows `.dev.vars` rather than hard-coding the secret
  - `seedTenant` now includes `contact_email` in the INSERT for this suite because the tenant contract requires it
  - Public `GET /api/tenants/:id` assertions explicitly require widget-safe projection only: `contact_email`, `created_date`, and `modified_date` must be absent while `opening_hours` is preserved
  - Removed legacy tenant CRUD expectations from `test/index.spec.ts` so the general API smoke suite no longer conflicts with the new admin-key requirement
  - Test execution was not run because the session directive rejected test commands with `Skip tests`

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
