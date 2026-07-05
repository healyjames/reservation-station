# Twinkie - History

## Core Context

Frontend Dev on the Maximum Bookings project. Owns the public widget, manage-booking flow, admin UI surface work, and shared Preact runtime boundaries.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph

### Stable Conventions

- No inline code comments unless genuinely necessary.
- Write-ups, planning docs, and analysis markdown belong in `./documentation/`.
- `theme.js` remains a blocking script in HTML `<head>` so theme state applies before first paint.
- Frontend surface folders under `src/frontend/` stay as thin entrypoints; reusable runtime code lives under `src/frontend/shared/`.
- `public/shared.css` is the shared base layer; `public/styles.css` and `public/admin/styles/admin.css` are surface layers on top of it.
- CSS module class names use underscores, not camelCase.
- Keep shared components compatible with the small set of intentional globals still owned by `public/shared.css`.

## Condensed Work History

- Established the vanilla widget/calendar baseline and booking-flow patterns, including UTC-safe date handling.
- Built and refined admin dashboard/settings UI, blocked-dates controls, and opening-hours management.
- Led the Preact migration into thin surface entries plus shared hooks, types, utilities, and components.
- Extended `CalendarGrid` for admin range-selection workflows without breaking widget or manage-booking consumers.

## Recent Learnings

### Blocked-times widget UX analysis (2026-07-02)

- Guest changes currently update `guests` immediately, clear `time` immediately, then wait 250ms before fetching guest-keyed blocked times.
- That debounce reduces request volume but still leaves a stale-data window and often replaces the Time control with a spinner on cache miss.
- If the team optimises this flow later, the preferred frontend shape is a date-level availability cache keyed by `(tenant, date)`, synchronous blocked-time recomputation on guest change, and preserving the selected time unless it becomes invalid.

### Concurrent capacity frontend model (2026-06-12)

- The booking widget no longer depends on `daily-capacity`; Step 1 should derive guest limits from tenant config and blocked times only.
- `max_guests` remains the per-booking cap, `max_covers` is venue concurrent capacity, and the guest dropdown should use the smallest positive limit between them or fall back to `20`.
- Date-level sellout messaging should come from blocked slots, not a removed daily-total capacity rule.

### Frontend structure + CSS boundaries (2026-05-27 to 2026-05-30)

- `src/frontend/index.html` is the canonical built root entry.
- Form controls in CSS modules must explicitly set `font-family: inherit`.
- `public/shared.css` stays focused on tokens, resets, shared primitives, and the few intentional globals used by shared components.
- The migration is complete: active frontend surfaces now run through Preact + CSS Modules.

### useBookings month-cache rewrite (2026-07-03)

- `useBookings.ts` fully rewritten: month-keyed cache, three-branch `fetchBookings` (cold load, warm same-month navigation, targeted same-day refresh), `refreshMonth()`, and cache-mutating `deleteBooking()` / `toggleDayBlock()`.
- `Dashboard.tsx` gains a Refresh button wired to `refreshMonth()`.
- Critical bug fixed: calendar picker no longer sets `currentDate.value` externally — prevents stale renders after month navigation.

### fetchBlockedTimes shared utility (2026-07-03)

- `src/frontend/shared/utils/fetchBlockedTimes.ts` centralises the blocked-times fetch/cache across `useAvailability.ts`, `useManageBooking.ts`, and `BookingApp.tsx`.
- Cache key is guest-agnostic for `maxCovers === 0` (unlimited-capacity) venues; guest-keyed for capacity-limited venues.
- Prefix-bust clears all cache entries for a given tenant+date prefix when a mutation occurs.

### Blocked date range intent (2026-07-05)

- `BlockedDatesSettings.tsx` now treats the first clicked day as the range intent: starting on a blocked day previews and performs range unblocking, starting on an open day previews and performs range blocking.
- The admin calendar preview uses red range styling for unblock mode so range intent stays visible before the second click.
