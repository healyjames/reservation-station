# Squad Decisions

## Active Decisions

### 2026-04-01: Tech stack confirmed
**By:** James Healy
**What:** Stack is Cloudflare Workers + Pages, D1 (SQLite), Hono (API framework), vanilla HTML/CSS/JS widget (no frontend framework).
**Why:** Lightweight embeddable widget must work on any site with minimal footprint. Cloudflare-native stack keeps latency low and ops simple.

### 2026-04-01: Team cast
**By:** James Healy
**What:** Team roster confirmed - Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph.
**Universe:** Fast and Furious: Tokyo Drift.

### 2026-04-01: No git operations by Copilot/squad
**By:** James Healy (via Copilot)
**What:** Squad must never run `git add`, `git commit`, or `git push`. Version control is managed exclusively by James.
**Why:** User request - captured for team memory.

### 2026-04-01: Calendar widget - design decisions
**By:** Twinkie (Frontend Dev)
**What:** Week starts Monday (ISO/UK norm). `SecondaryFont` resolved via `@font-face { src: local('Google+Sans') }` + Google Fonts fallback. `.today` uses dot indicator; `.selected` uses filled background. Warm burgundy palette (`--primary: #8b2635`). Prev-nav uses `pointer-events: none` + `disabled` (belt-and-suspenders). `renderCalendar` clears and rebuilds on every call (no DOM diffing).
**Why:** Restaurant-appropriate aesthetics, reliable cross-browser font rendering, simple predictable render model.

### 2026-04-01: Asset split - CSS and JS extracted from index.html
**By:** Twinkie (Frontend Dev)
**What:** Split `public/index.html` into `public/styles.css`, `public/js/theme.js` (blocking, in `<head>`), and `public/js/calendar.js` (ES module, deferred). No behaviour or visual change.
**Why:** Separation of concerns; `type="module"` gives free implicit defer and module scope; blocking theme script prevents flash of incorrect theme.

### 2026-04-01: Booking form - two-step module architecture
**By:** Twinkie (Frontend Dev)
**What:** Booking form lives in `public/js/booking-form.js` as a separate ES module; `calendar.js` uses dynamic import to load it on date selection. Module-scoped `formState` tracks step and form data. Real-time validation on input events.
**Why:** Clean separation of concerns; lazy-loads form code only when needed; no global state pollution; consistent dark theme throughout.

### 2026-04-01: Blocked times UI pattern
**By:** Twinkie (Frontend Dev)
**What:** Fail-open on API errors (`fetchBlockedTimes` returns `[]`). Re-render entire step 1 on guest count change (clean state, no edge cases). Show actionable no-availability message when all slots blocked (suggests fewer guests or different date). `formState.blockedTimes` kept as top-level derived state.
**Why:** Network failures must not block customers; backend enforces hard capacity limit at creation time. Re-rendering is simple and eliminates stale state risk.

### 2026-04-01: Blocked times test coverage
**By:** Neela (Tester)
**What:** 6 test cases for `GET /api/reservations/blocked-times`: missing params (400), unknown tenant (404), empty state (no blocks), `max_guests=0` (unlimited - never blocks), capacity boundary (slot blocked when sum exceeds limit), time-window boundary (distant slots not blocked). Far-future dates (2099) used to avoid `block_current_day` conflicts.
**Why:** Edge case noted - `max_guests=0` means no concurrent limit, must always return empty `blocked_times`.

### 2026-04-05: Concurrent guest time limit
**By:** Sean (Backend Dev) - requested by James Healy
**What:** Added `concurrent_guests_time_limit INTEGER NOT NULL DEFAULT 120` to Tenants table. New endpoint `GET /api/reservations/blocked-times` computes which time slots would exceed `max_guests` within the time window using `|slotMinutes - reservationMinutes| < concurrent_guests_time_limit`. Returns `{ blocked_times, time_limit_minutes }`. Frontend fetches on date selection and guest count change.
**Why:** `max_guests` is concurrent capacity. Without a time window, the system had no way to calculate overlapping occupancy. Configurable per tenant to match table turnover patterns.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
