# Han - History

## Core Context

Lead on the Maximum Bookings project. Restaurant booking system built on Cloudflare Workers + Pages, D1, Hono, vanilla JS widget.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph

## Learnings

- Project kickoff: 2026-04-01
- Stack confirmed: Cloudflare Workers + Pages, D1, Hono, vanilla HTML/CSS/JS widget
- Widget must be embeddable on any site - no framework dependencies
- BlockedDates system replaces `block_current_day` boolean on Tenants. Full-day block = row with `start_time IS NULL`. Multiple rows per date allowed (for time-range blocks). Blocking is additive - never cancels existing reservations. Admin toggle maps to POST/DELETE on `/api/admin/blocked-dates`. Calendar widget queries blocked dates per month via a single public endpoint. `blocked-times` endpoint must short-circuit on full-day block before running capacity query.
- Opening Hours: `OpeningHours` table keyed on `(tenant_id, day_of_week)`. `day_of_week` uses `Date.getDay()` / SQLite `strftime('%w')` encoding (0=Sunday, 6=Saturday). `is_closed=1` = fully closed that day. Default fallback when no rows = all days open, 12:00–21:30. `GET /api/tenants/:tenant_code` extended with `opening_hours` (null when unconfigured). `blocked-dates` endpoint generates closed-dow dates in application code. `generateTimeSlots()` gains optional `openTime`/`closeTime` params — `22:00` exclusive upper bound preserves the 21:30 last-slot default. Admin PUT `/api/admin/opening-hours` is a full 7-row batch replace. Frontend replaces `TIME_SLOTS` constant with `getSlotsForDate(dateStr)` reading `tenantConfig.opening_hours`.
