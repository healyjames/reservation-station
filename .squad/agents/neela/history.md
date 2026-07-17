# Neela - History

## Core Context

Tester on the Maximum Bookings project. Owns Vitest coverage, black-box behavioural assertions, and implementation reviews from a quality perspective.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe

## Key File Paths

- `test/` - test files
- `vitest.config.mts` - Vitest config

## Recent Learnings

### API request optimisation coverage (2026-07-02)

- Coverage for the request-optimisation work lives across the shared blocked-dates fetch util, `useAvailability` times caching, `useManageBooking` double-submit guards, and `BookingApp` guest-change debounce behaviour.
- The important contracts are cache hit/miss behaviour, TTL expiry, abort handling, cache busting after booking, and mutation guards that prevent duplicate save/cancel requests.

### Concurrent capacity reservation tests (2026-06-12)

- `POST /api/reservations` coverage should use rolling-window scenarios, not same-day summed covers.
- Keep explicit cases for non-overlapping windows, overlapping overflow rejection, exact time-limit boundary acceptance, and unlimited capacity when `max_covers = 0`.

### Tenant auth/projection coverage (2026-06-12)

- Tenant CRUD auth coverage belongs in `test/tenants.spec.ts`, not the general reservation smoke suite.
- Public `GET /api/tenants/:id` assertions should require widget-safe projection only while preserving `opening_hours`.

### Stable testing patterns

- Prefer black-box behavioural assertions over implementation-detail checks like logging.
- Use far-future dates to avoid same-day interference in booking tests.
- Keep UUID ranges distinct per suite to avoid collisions.
- For fetch-heavy tests, `vi.stubGlobal('fetch', vi.fn())` remains the cleanest pattern.
- Opening-hours and blocked-dates coverage should assert observable contract behaviour rather than internal slot-generation details.

## Learnings

### Tenant onboarding test contract (2026-07-07)

- `test/tenants.spec.ts` is the contract suite for onboarding: nested payload validation, auth, tenant/admin/opening-hours persistence, admin login, duplicate rollback, and invalid-payload no-write behaviour.
- The accepted run is `npx vitest run test\tenants.spec.ts --reporter=dot` with 30 tests passing.

### API optimisation regression coverage (2026-07-03)

- `fetchBlockedTimes` cache keys must stay guest-aware only for capacity-limited venues (`max_covers > 0`); unlimited venues share a date-level cache entry.
- `useBookings` needs separate coverage for cold month loads, warm same-month navigation, and same-day targeted sync refreshes.
- Admin month-query coverage should include empty-result behaviour and `month` precedence over `date`, not just validation and tenant isolation.

### API optimisation test suite delivered (2026-07-03)

- Fixed `useAvailability.test.ts` guest-cache test: now passes `maxCovers: 40` to exercise the capacity-limited cache key path.
- `fetchBlockedTimes.test.ts` created (8 tests, all pass): cache hit/miss, abort on new request, guest-agnostic key for `maxCovers === 0`, prefix-bust after mutation.
- `useBookings.test.ts` created (10 tests, all pass): cold month load, warm same-month navigation, targeted day refresh, `deleteBooking` cache mutation, `toggleDayBlock` cache mutation.
- `test/admin.spec.ts` extended with 3 tests: empty-result month, `?month` precedence over `?date`, tenant isolation on month filter.

### Tenant onboarding contract coverage (2026-07-07)

- `POST /api/tenants` now owns platform onboarding coverage: nested tenant/admin payloads, default closed opening hours, provided opening hours, admin login verification, duplicate uniqueness atomicity, and invalid-payload no-write assertions.
- Targeted Cloudflare D1 Vitest runs may need the tenants spec to bootstrap its schema before clearing rows so isolated runs do not fail with missing tables.

### DateOverrides — 15 test cases pending (2026-07-08)

- Han produced `documentation/date-specific-opening-hours-plan.md` specifying 15 test cases for the new `DateOverrides` feature.
- Neela's pending items: write test coverage for the four override scenarios (special hours, full-closure override, DOW unblock, re-close normally-open day), COALESCE precedence ordering (DateOverrides wins over DOW, BlockedDates wins over DateOverrides), and edge cases (no override row falls back to DOW, override with is_closed=1 on normally-open day, partial-hours override where only open_time is set).
- Tests live in the existing suite alongside `availability.ts` and `reservations.ts` contract coverage.
