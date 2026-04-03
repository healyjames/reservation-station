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
