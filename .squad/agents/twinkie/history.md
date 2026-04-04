# Twinkie — History

## Core Context

Frontend Dev on the Reservation Station project. Owns the embeddable booking widget — vanilla HTML/CSS/JS, no framework.

**User:** James Healy  
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph  

## Key File Paths

- `public/` — widget assets

## Learnings

- Project kickoff: 2026-04-01
- Widget must be embeddable on any site — no framework, pure HTML/CSS/JS
- Must handle cross-origin API calls to the Workers API
- CSS custom properties for host-site theming

### Asset split refactor (2026-04-01)

`public/index.html` was split from a monolithic ~713-line file into three separate assets (no build step):

**New file structure:**
```
public/
  index.html       (~30 lines — clean HTML, no inline CSS or JS)
  styles.css       (all styles, including @import for Google Fonts)
  js/
    theme.js       (blocking script in <head>; reads ?theme=/?mode=, applies CSS custom props before first paint)
    calendar.js    (ES module via type="module"; all vars are module-scoped, not global; self-initialises inline)
```

**Module approach:**
- `theme.js` is a plain script (no `type="module"`) so it blocks rendering — required to prevent flash of incorrect theme
- `calendar.js` uses `type="module"` for implicit defer + clean module scope; no exports needed since it self-initialises by running at top level (DOM is ready because module scripts are deferred)

### Calendar widget — standalone date picker (2026-04-01)

**Built:** `public/index.html` — fully self-contained responsive date picker calendar page.

**Key patterns used:**
- `renderCalendar(year, month)` renders the full grid on each call (clear + rebuild); state held in `currentYear`, `currentMonth`, `selectedDate`
- Week starts Monday: `getDay()` returns Sun=0 so leading empties = `(getDay() === 0) ? 6 : getDay() - 1`
- Today detection: compare year/month/day only against a snapshot of `new Date()` captured at script load
- Past detection: `isBeforeToday(year, month, day)` — no time comparison, date-only
- `.today` class uses a dot indicator (`::after` pseudo-element) so it's visually distinct from `.selected`
- Prev nav button: disabled (and `pointer-events: none`) when `year === todayYear && month === todayMonth`
- Keyboard: `tabindex="0"` + `keydown` listener for Enter/Space on selectable days; `aria-pressed` reflects selection state; `aria-live="polite"` on the date display
- `SecondaryFont` declared via `@font-face { src: local('Lora') }` backed by a Google Fonts `@import`; CSS override `font-family: 'Lora', 'SecondaryFont', Georgia, serif` ensures Lora renders correctly regardless of local() availability
- Warm burgundy colour palette (`--primary: #8b2635`) with cream background — restaurant-appropriate
- Responsive: tighter grid gaps + smaller font on `max-width: 480px`

**File paths:**
- `public/index.html` — replaced boilerplate with calendar widget preview

### Multi-step booking form (2026-04-01)

**Built:** `public/js/booking-form.js` — two-step booking form that replaces calendar after date selection.

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
- `public/index.html` — added IDs and booking container
- `public/js/calendar.js` — added dynamic import call in `selectDay()`
- `public/styles.css` — added dark theme form styles at end
- `public/js/booking-form.js` — new module (created)
