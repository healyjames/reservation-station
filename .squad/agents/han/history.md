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
- **Phase 3 Layer D — DayCell `styles` prop pattern:** DayCell has no CSS module of its own. CalendarGrid passes its own CSS module object (`styles`) as a prop to DayCell. This avoids a circular CSS Module reference (DayCell would need CalendarGrid's module, but CalendarGrid imports DayCell). The styles prop is typed as `Record<string, string>` — tests use a Proxy to return the class key as its own value.
- **Phase 3 Layer D — CalendarGrid leading-empty calculation:** Mon-first week. `firstDayOfWeek = new Date(year, month, 1).getDay()`. Leading empties = `firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1`. Jan 1 2024 is Monday (getDay()=1) → 0 empties. Feb 1 2024 is Thursday (getDay()=4) → 3 empties. Sunday (getDay()=0) → 6 empties (wraps to end of week). This exactly mirrors `calendar-core.js`.
- **Phase 3 Layer D — vitest JSX for Preact:** Do NOT use `@preact/preset-vite` in `vitest.frontend.config.ts`. The `preact:transform-hook-names` sub-plugin fails on `useRef` with `zimmerframe` package.json missing exports. Instead use `esbuild: { jsxImportSource: 'preact' }` directly in the vitest config — this handles JSX transform without the problematic Preact plugin. Add `react`/`react-dom` → `preact/compat` aliases for libraries that expect React.
- **Phase 3 Layer D — `:has` / `data-checked` not needed:** No CSS `:has()` selectors were required. All state styling in CalendarGrid/DayCell uses plain class names (`.selected`, `.today`, `.past`, `.blocked`). BlockedTooltip uses inline styles for `fixed` positioning only; visual chrome is in CSS Module.
- **Phase 3 Layer D — CalendarGrid preserves calendar-core.js (2026-05-23):** `CalendarGrid.tsx` is a direct Preact port of `calendar-core.js`. The vanilla file MUST remain at `public/js/calendar-core.js` until Phase 7 (admin Preact migration). Do not delete it before both the widget and admin are fully migrated.
- **Phase 3 Layer D — vitest esbuild JSX fix (reinforced, 2026-05-23):** The `esbuild: { jsxImportSource: 'preact' }` approach in vitest config is confirmed correct. If the vitest config is ever regenerated from the Vite config, verify the `@preact/preset-vite` plugin is excluded from the `plugins` array used in vitest — add a filter to strip it out.
