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
