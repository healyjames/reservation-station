# Session Log — Capacity Model Fix

**Timestamp:** 2026-06-12T18:19:23Z  
**Topic:** capacity-model-fix  
**Feature:** Rolling concurrent occupancy

---

Replaced the mixed daily-total/concurrent capacity behaviour with a single rolling occupancy model across the reservation API, booking widget, admin wording, and regression tests.

- blocked-times now checks `max_covers`
- reservation POST now uses `calculateConcurrentGuests(...)`
- frontend `daily-capacity` state was removed
- Step 1 tests and POST capacity tests were rewritten
- `BUSINESS_LOGIC.md` was added as the canonical model write-up
