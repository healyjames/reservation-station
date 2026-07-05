### 2026-07-05T17:18:33+01:00: blocked-dates test suite updated for split response shape
**By:** Neela
**What:** Updated two test files to match the new `GET /api/reservations/blocked-dates` response shape (`blocked_dates` + `closed_dates`) and the new `fetchBlockedDatesForMonth` return type (`adminBlocked` + `closed` instead of `dates`).

**Changes — `fetchBlockedDatesForMonth.test.ts`:**
- All `result.dates` references replaced with `result.adminBlocked` (or `result.closed` where appropriate)
- All mock responses updated to include `closed_dates: []` alongside `blocked_dates`
- Error path tests now assert `result.adminBlocked.size === 0` and `result.closed.size === 0`
- Test description updated: "returns dates" → "returns adminBlocked dates"; error descriptions updated similarly
- Three new tests added:
  - `'populates only adminBlocked when API returns blocked_dates with no closed_dates'`
  - `'populates only closed when API returns closed_dates with no blocked_dates'`
  - `'populates both adminBlocked and closed independently when API returns both arrays'`
- New tests use unique tenant IDs: `tenant-admin-only-1`, `tenant-closed-only-1`, `tenant-both-1`

**Changes — `useAvailability.test.ts`:**
- `fetchBlockedDates` describe block: all mock responses updated to include `closed_dates: []`
- One new test added: `'populates closedDates signal when API returns closed_dates'` (tenant `tenant-bd-closed-1`)
- `fetchBlockedTimes` describe block: untouched (unaffected by the shape change)
- All existing assertions preserved — they test the right things, the mock shape was the only gap

**Why:** Tests must describe the contract that the code is held to. Stale assertions against the old shape would pass on the old code and fail to catch regressions against the new shape (or vice versa). Every test name is documentation of the expected behaviour.
