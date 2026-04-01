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
