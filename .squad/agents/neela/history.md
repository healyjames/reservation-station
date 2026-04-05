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
- **Oak Tavern scenario tests (2026-04-01):** Added a new `describe('GET /api/reservations/blocked-times — Oak Tavern scenario')` block with 4 tests modelling a busy lunch scenario using `TENANT_ID`, `max_guests: 10`, `concurrent_guests_time_limit: 120`, date `2099-06-15`:
  1. Lunch cluster (13:00/4g + 13:30/4g) with `guests=3` → 13:00, 13:30, 14:00 all blocked (8+3=11 > 10)
  2. Same cluster with `guests=1` → no slots blocked (8+1=9 ≤ 10)
  3. Same cluster with `guests=3` → 16:00, 19:00, 20:00 NOT blocked (≥120 min from all bookings)
  4. Three bookings (13:00/4g + 13:30/3g + 14:00/2g = 9 concurrent): `guests=1` not blocked (9+1=10), `guests=2` blocked (9+2=11 > 10)
  - Used inline ID literals `'00000000-0000-4000-8000-000000000020'` and `'00000000-0000-4000-8000-000000000021'` for extra reservations
