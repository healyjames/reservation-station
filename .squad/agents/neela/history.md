# Neela — History

## Core Context

Tester on the Reservation Station project. Writes Vitest tests, reviews implementations, quality gate.

**User:** James Healy  
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph  

## Key File Paths

- `test/` — test files
- `vitest.config.mts` — Vitest config

## Learnings

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
