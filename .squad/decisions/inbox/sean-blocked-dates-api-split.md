### 2026-07-05T17:18:33+01:00: blocked-dates API shape change
**By:** Sean
**What:** GET /blocked-dates now returns { blocked_dates: string[], closed_dates: string[] } instead of a merged { blocked_dates: string[] }. Admin-blocked dates and venue-closed dates are kept separate so the frontend can show distinct tooltip messages.
**Why:** Feature requirement — different tooltip text for admin-blocked vs venue-closed dates.
