# Twinkie - History

## Core Context

Frontend Dev on the Maximum Bookings project. Owns the embeddable booking widget - vanilla HTML/CSS/JS, no framework.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph

## Key File Paths

- `public/` - widget assets

## Learnings

- Project kickoff: 2026-04-01
- Widget must be embeddable on any site - no framework, pure HTML/CSS/JS
- Must handle cross-origin API calls to the Workers API
- CSS custom properties for host-site theming

### Asset split refactor (2026-04-01)

`public/index.html` was split from a monolithic ~713-line file into three separate assets (no build step):

**New file structure:**
```
public/
  index.html       (~30 lines - clean HTML, no inline CSS or JS)
  styles.css       (all styles, including @import for Google Fonts)
  js/
    theme.js       (blocking script in <head>; reads ?theme=/?mode=, applies CSS custom props before first paint)
    calendar.js    (ES module via type="module"; all vars are module-scoped, not global; self-initialises inline)
```

**Module approach:**
- `theme.js` is a plain script (no `type="module"`) so it blocks rendering - required to prevent flash of incorrect theme
- `calendar.js` uses `type="module"` for implicit defer + clean module scope; no exports needed since it self-initialises by running at top level (DOM is ready because module scripts are deferred)

### Calendar widget - standalone date picker (2026-04-01)

**Built:** `public/index.html` - fully self-contained responsive date picker calendar page.

**Key patterns used:**
- `renderCalendar(year, month)` renders the full grid on each call (clear + rebuild); state held in `currentYear`, `currentMonth`, `selectedDate`
- Week starts Monday: `getDay()` returns Sun=0 so leading empties = `(getDay() === 0) ? 6 : getDay() - 1`
- Today detection: compare year/month/day only against a snapshot of `new Date()` captured at script load
- Past detection: `isBeforeToday(year, month, day)` - no time comparison, date-only
- `.today` class uses a dot indicator (`::after` pseudo-element) so it's visually distinct from `.selected`
- Prev nav button: disabled (and `pointer-events: none`) when `year === todayYear && month === todayMonth`
- Keyboard: `tabindex="0"` + `keydown` listener for Enter/Space on selectable days; `aria-pressed` reflects selection state; `aria-live="polite"` on the date display
- `SecondaryFont` declared via `@font-face { src: local('Google+Sans') }` backed by a Google Fonts `@import`; CSS override `font-family: 'Google+Sans', 'SecondaryFont', Georgia, serif` ensures Google+Sans renders correctly regardless of local() availability
- Warm burgundy colour palette (`--primary: #8b2635`) with cream background - restaurant-appropriate
- Responsive: tighter grid gaps + smaller font on `max-width: 480px`

**File paths:**
- `public/index.html` - replaced boilerplate with calendar widget preview

### Multi-step booking form (2026-04-01)

**Built:** `public/js/booking-form.js` - two-step booking form that replaces calendar after date selection.

**Flow:**
- User picks date on calendar → calendar hides, booking form shows
- Step 1: Booking details (guests, time, change date button)
- Step 2: Personal details (name, email, phone, dietary requirements)
- Submit → POST to `/api/reservations`
- Success → confirmation message with "Make Another Booking" button

**Key patterns:**
- Module-scoped `formState` object tracks step, selectedDate, and all form data
- ES module export: `showBookingForm(selectedDate)` called by calendar.js via dynamic import
- Navigation: re-used `.calendar-nav button` styles for arrow buttons; "Change date" button calls `hideBookingForm()` to return to calendar
- Time slots: generated programmatically 12:00 to 21:30 in 30-min intervals
- Step validation: Step 1 requires guests ≥ 1 and time selected; Step 2 requires firstName, surname, email, telephone (non-empty)
- Real-time validation: input event listeners update button disabled states immediately
- Tenant ID resolution: `getTenantId()` checks `data-tenant-id` on `<body>` first, then falls back to URL query param `?tenant_id=`
- Error handling: inline error messages above submit button; network errors and API errors handled separately
- Success state: replaces form with confirmation message including booking details and reset button

**Dark theme form styling:**
- All form inputs use dark theme (background-light, primary focus border, foreground text)
- `.form-group` overrides scoped to `#booking-container` to avoid conflicts with existing white `.form-container`
- Step indicator shows "Step X of 2" with primary-lighter color on background-light
- Selected date info box with "Change date" button styled like calendar nav
- Responsive: stacks header vertically on small screens

**DOM structure:**
- Added `id="calendar-container"` to existing `.calendar-container` div in index.html
- Added `<div id="booking-container" hidden></div>` after calendar container
- Added `<script type="module" src="/js/booking-form.js"></script>` to index.html
- Form built dynamically via `.innerHTML` in `renderStep1()` and `renderStep2()`

**Files modified:**
- `public/index.html` - added IDs and booking container
- `public/js/calendar.js` - added dynamic import call in `selectDay()`
- `public/styles.css` - added dark theme form styles at end
- `public/js/booking-form.js` - new module (created)

### Admin Login UI — Phase 3 (2026-04-01)

**Built:** Admin login page and auth utilities under `public/admin/`.

**File structure:**
```
public/admin/
├── index.html           ← Login page (SPA-style)
├── styles/
│   └── admin.css        ← Admin design tokens + login layout
└── js/
    └── auth.js          ← AdminAuth global (login, logout, getToken, getTenant, requireAuth)
```

**Design tokens:**
- Admin uses warm burgundy palette (`--primary: #8b2635`), distinct from the public widget's current indigo theme
- Same Google Sans font via `/fonts/` — loaded with @font-face in admin.css
- Light background with a centered card (`max-width: 400px`); mobile-first (full-width below 480px)

**Auth flow patterns:**
- On load: blocking inline `<script>` in `<head>` redirects immediately to `dashboard.html` if `admin_token` exists — prevents flash of login form for already-authenticated users
- `?expired=1` query param shows an amber "session expired" banner on load
- Error messages are inline (not alerts): `.alert-error` div with `aria-live="assertive"`
- Loading state: CSS-only spinner via `.btn-primary.loading::after` pseudo-element + `color: transparent` to hide label text
- `AdminAuth` is an IIFE that exposes a global on `window` — no bundler needed

**Error handling:**
- 401 → "Invalid email or password."
- 429 → "Too many failed attempts. Please try again later."
- Network error (no `err.status`) → "Unable to connect. Please check your connection."
- Typing in either field clears the error banner immediately

### Admin Dashboard — Phases 4–7 (2026-04-05)

**Built:** Full dashboard experience — `public/admin/dashboard.html`, `dashboard.js`, `booking-modal.js`, `settings.js`, plus all supporting CSS added to `admin.css`.

**File structure added:**
```
public/admin/
├── dashboard.html            ← Dashboard page (Bookings + Settings tabs)
└── js/
    ├── booking-modal.js      ← Edit/Delete modal (window.BookingModal)
    ├── settings.js           ← Tenant settings form (window.SettingsManager)
    └── dashboard.js          ← Main dashboard controller (IIFE)
```

**Key patterns used:**

- Auth guard: blocking `<script>` in `<head>` redirects immediately if no `admin_token` in localStorage — same pattern as login page; `AdminAuth.requireAuth()` called again in JS as belt-and-suspenders
- Tenant name pre-populated from `AdminAuth.getTenant()` (cached localStorage) on first paint, then overwritten when fresh `/api/admin/me` resolves — prevents blank flash
- `<dialog>` element for modal: `showModal()` handles focus trap and Escape natively; backdrop click handled manually by checking `e.target === dialog`; single dialog element created once, reused for both edit and delete
- Modal is full-screen on mobile (`width: 100vw; border-radius: 0; position: fixed; inset: 0`) via `@media (max-width: 640px)`
- Booking list: desktop table + mobile cards rendered together (one hidden via CSS); same event listener wiring for both
- Date navigation: pure date arithmetic via `Date(y, m-1, d)` + `setDate()` — avoids timezone issues from `new Date(string)` parsing
- `updateDaySummary()` hides capacity bar when `max_covers === 0` (unlimited); colour-codes fill at 75% (amber) and 90% (burgundy)
- Settings tab lazy-initialised on first activation (`settingsInitialized` flag) — avoids `/api/admin/me` double-fetch on page load
- Settings `block_current_day` sent as integer `1`/`0` to match SQLite storage
- All 401 responses → `AdminAuth.logout()` across all three JS modules
- No `alert()` anywhere — all errors are inline `.alert-error` elements with `aria-live`
- Print: table always rendered (shown in print via `display: table !important`), cards always rendered (hidden in print); `.print-only` header with date + venue name shown only when printing

**CSS additions to `admin.css`:**
- Dashboard layout, header, nav tabs, date controls, summary bar, capacity bar, booking table, booking cards (mobile), action buttons (edit/delete/danger/secondary), `<dialog>` modal, settings panel, empty/loading/error states, print header, mobile responsive pass at 640px breakpoint


### Cross-agent notes

- **No code comments directive (2026-04-07):** James directed that inline comments, explanatory comments, and JSDoc are not to be added to code changes unless genuinely necessary. Apply to all JS/HTML/CSS edits.
- **Planning artifacts location (2026-04-12):** Planning docs and design notes go in `.squad/temp/` — not in the Copilot session state directory.
- **Admin auth dependency (2026-04-05):** `window.AdminAuth` on the login page depends on `POST /api/auth/login` (Sean's phase 1). All three JS modules (`dashboard.js`, `booking-modal.js`, `settings.js`) route 401 responses through `AdminAuth.logout()` to maintain consistent session expiry handling.

### Blocked time slots filtering (2026-04-01)

**Added:** Dynamic time slot filtering based on restaurant capacity using backend `blocked-times` endpoint.

**Flow:**
- When booking form opens, fetch blocked times for selected date + default guest count (2)
- When guest count changes, re-fetch blocked times and filter dropdown dynamically
- If selected time becomes blocked, reset it and force re-selection
- If all times blocked, show friendly message instead of empty dropdown

**Key patterns:**
- `formState.blockedTimes` array stores current blocked time strings (HH:MM format)
- `fetchBlockedTimes(date, guests)` async function hits `/api/reservations/blocked-times?tenant_id={id}&date={YYYY-MM-DD}&guests={n}`, fails gracefully (returns `[]` on error = fail-open UX)
- `showBookingForm(selectedDate)` made async to fetch initial blocked times before rendering
- Guests change handler re-fetches + re-renders entire step 1 (clean state sync)
- Time dropdown filters `TIME_SLOTS.filter(slot => !formState.blockedTimes.includes(slot))`
- No-availability message: `<p class="no-availability">` with helpful suggestion to try fewer guests or different date
- `resetForm()` includes `blockedTimes: []` cleanup

**UX decisions:**
- Fail open: network/API errors show all slots rather than blocking user
- Immediate feedback: guest count change triggers instant re-fetch and dropdown update
- Clear messaging: when fully blocked, suggest actionable alternatives (fewer guests / different date)
- Selection preservation: time choice only reset if it becomes newly blocked, otherwise retained across guest changes

**Files modified:**
- `public/js/booking-form.js` - added blocked times fetching, filtering, and dynamic re-rendering
