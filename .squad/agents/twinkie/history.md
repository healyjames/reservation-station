# Twinkie - History

## Core Context

Frontend Dev on the Maximum Bookings project. Owns the embeddable booking widget - vanilla HTML/CSS/JS, no framework.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph

### Condensed Work History

- **No code comments (2026-04-07):** James directed no inline comments unless genuinely necessary. Apply to all JS/HTML/CSS edits.
- **Planning artifacts (2026-04-12):** Go in `.squad/temp/` — not in the Copilot session state directory.
- **Asset split (2026-04-01):** `public/index.html` split into `styles.css`, `js/theme.js` (blocking, prevents FOICT), `js/calendar.js` (ES module, deferred). `theme.js` is plain script (no `type="module"`); `calendar.js` uses `type="module"`.
- **Calendar widget (2026-04-01):** Week starts Monday (`getDay()===0 ? 6 : getDay()-1`). `.today` dot indicator; `.selected` filled background. Warm burgundy palette (`--primary: #8b2635`). Prev nav disabled on current month (HTML attr + `pointer-events: none`). `renderCalendar` clears/rebuilds on every call.
- **Multi-step booking form (2026-04-01):** `public/js/booking-form.js` ES module. Step 1: guests + time. Step 2: name, email, phone, dietary. Module-scoped `formState`. Dynamic import from `calendar.js`. `getTenantId()` checks `data-tenant-id` on `<body>`, falls back to `?tenant_id=` query param.
- **Blocked times UI (2026-04-01):** Fail-open on API errors (`fetchBlockedTimes` returns `[]`). Re-render entire Step 1 on guest count change. No-availability message when all slots blocked.
- **Admin login UI (2026-04-05):** `public/admin/` — `index.html`, `styles/admin.css`, `js/auth.js` (`window.AdminAuth` IIFE). Blocking redirect in `<head>`. CSS-only spinner. `aria-live="assertive"` error banner. No `window.alert()`.
- **Admin dashboard (2026-04-05):** `dashboard.html`, `dashboard.js`, `booking-modal.js`, `settings.js`. Native `<dialog>` for modal. Table + cards dual-render (640px CSS toggle). Settings tab lazy-init. `block_current_day` sent as `1`/`0`. All 401 → `AdminAuth.logout()`.
- **Spacing tokens (2026-04-13):** `/* SPACING & SIZING TOKENS */` in `public/shared.css` — 36 CSS custom properties, 4px base, `--space-1` through `--space-16`. Applied to `styles.css` and `admin.css`. Decorative values (box-shadow offsets, animation transforms) left as-is.
- **Sidebar grid layout (2026-04-14):** 4-cell CSS Grid (sidebar-logo / topbar-actions / sidebar-nav / main-content). `--sidebar-width: 220px`. Active nav: left-border on desktop. 768px breakpoint collapses to horizontal scroll-nav. Superseded by 2-div layout same day.
- **2-div layout (2026-04-14):** Replaced with `.sidebar-nav` + `.main-panel` (flex column: `.main-header` + `#main-content`). `display: contents` on `.main-panel` at mobile for `order` control. All JS-consumed IDs unchanged.
- **Admin date picker + calendar-core extraction (2026-05-14):** `public/js/calendar-core.js` exports `MONTHS`, `DAY_NAMES`, `renderCalendarGrid(gridEl, year, month, options)`. `public/admin/js/date-picker.js` IIFE, `window.DatePicker`. `calendar.js` imports from `calendar-core.js` and passes `cellClass: 'calendar-day'`, `headerClass: 'day-name'`. Popup appended to `document.body`, `position: fixed`. Admin allows past dates (clickable).
- **CSS-only tooltip (settings, time-window field):** Markup inside `<label>` so `label:has(.info-trigger:hover)` CSS `:has()` shows/hides purely in CSS. `updateTooltip(container)` reads `#sf-max-guests` / `#sf-time-window` live on `input` events.
- **BlockedDates UI migration (2026-05-14):** Removed `block_current_day` toggle. Added per-day block toggle in `#day-block-container` (optimistic UI, reverts on error). `calendar.js` `renderCalendar` made async; `fetchBlockedDates(year, month)` per-month navigation. `apiFetch` merges `headers` option (backward-compatible). Fails open.
- **Blocked day tooltip (2026-05-14):** `renderCalendarGrid` gains `isBlocked`/`onBlockedSelect` options (no-ops by default). Blocked cells get `${cellClass}--blocked` class. `showBlockedTooltip` appends `<div role="tooltip">` to calendar container; auto-dismisses 3s or outside click; `setTimeout(..., 0)` defers dismiss listener; full `try/catch` guard.
- **Opening Hours frontend (2026-05-14):** `OpeningHoursManager` IIFE in `settings.js`. 7-row schedule table (Mon→Sun, dow 1→0). Closed checkbox toggles `disabled` + `.oh-times` opacity (no full re-render). PUT sends all 7 rows; `open_time`/`close_time` null when `is_closed: true`. `booking-form.js` replaces `TIME_SLOTS` constant with `generateSlots(openTime, closeTime)` + `getSlotsForDate(date)`. `getSlotsForDate` uses `getUTCDay()` on `T12:00:00Z` to avoid timezone drift. Falls back to `generateSlots('12:00', '22:00')` when `opening_hours` null/empty.
- **Font preload hints (2026-05-14):** `<link rel="preload">` for both self-hosted variable font files added to all three HTML entry points before stylesheet links. Moves font requests to first-HTML-parse time to eliminate download gap causing FOUT.

## Key File Paths

- `public/` - widget assets

## Learnings

### Phase 4 — Cancel surface (first Preact page) (2026-05-24)

- URL param is `?id=` (reservation UUID only), NOT `?ref=` or `?tenant=` — the migration doc had incorrect assumptions; always read the vanilla JS source before writing the entry point
- The cancel surface needs its own entry in `vite.config.ts` rollup inputs (`'cancel': resolve(__dirname, 'src/frontend/cancel/index.html')`)
- Used `useSignal` from `@preact/signals` (not bare `signal()`) inside hooks to avoid signal recreation on every render
- `cancel.tsx` (not `.ts`) because the entry point contains JSX for the `render()` call
- `src/frontend/vite-env.d.ts` with `/// <reference types="vite/client" />` is required to resolve `*.module.css` type errors in TypeScript — this was a pre-existing gap in the tsconfig, not something introduced in Phase 4

### Phase 3 Layers A/B/C/E — 12 shared Preact components — patterns (2026-05-23)

**Modal jsdom showModal() guard:** jsdom does not implement `HTMLDialogElement.showModal()` or `.close()`. Both calls are guarded with `typeof dialog.showModal === 'function'`. Modal renders safely in the test environment without this check triggering errors.

**ToggleSwitch `data-checked` strategy (reinforced):** `data-checked` on the wrapper `<label>` is the correct pattern. `:has(input:checked)` works in production Vite but is unreliable in jsdom. Do not switch to `:has`.

**Disabled element jsdom bypass:** `fireEvent.click` from `@testing-library` dispatches click/change events even on disabled form elements — real browsers do not. Always add an explicit `if (disabled) return` guard inside Button `onClick` and ToggleSwitch `onChange`.

**BookingDetailsList uses global classes:** No CSS Module. Renders `.details-list` / `.detail-row` from `public/shared.css`. This is intentional — do not add a CSS Module to this component without migrating the class names across all consumers first.

### Phase 3 Layers A/B/C/E — 12 shared Preact components (2026-05-23)

**@keyframes in CSS Modules:** Defined `@keyframes spin` at the top level of `Spinner.module.css`. Vite's CSS Modules implementation locally-scopes `@keyframes` names by default (mangling them), so there is no global name collision risk. No `:local()` wrapper required.

**ToggleSwitch CSS strategy:** Used `data-checked` attribute on the wrapper `<label>` element driven by the `checked` prop, rather than `:has(input:checked)`. The `[data-checked="true"] .track` and `[data-checked="true"] .thumb` selectors work reliably within CSS Modules scope because the attribute selector operates on the scoped class wrapper. `:has(input:checked)` would also work in production Vite but is less reliable in test environments.

**@testing-library/preact:** Was NOT installed prior to this phase — had to `npm install --save-dev @testing-library/preact jsdom`.

**Modal / createPortal gotchas:** jsdom does not implement `HTMLDialogElement.showModal()` or `.close()`. Guarded both calls with `typeof dialog.showModal === 'function'` checks so the Modal renders safely in the test environment. createPortal into `document.body` works fine in jsdom — no issues with the portal target.

**Disabled element event bypass in jsdom:** `fireEvent.click` from `@testing-library` bypasses the browser's disabled-element behavior (real browsers don't dispatch click/change events on disabled form elements, but `fireEvent` does). Fixed by adding explicit disabled guards inside the Button `onClick` handler and ToggleSwitch `onChange` handler.

**BookingDetailsList — no CSS Module:** This component intentionally uses no CSS Module. It renders global `.details-list` / `.detail-row` class names from `public/shared.css`. Documented with a comment in the file.

### Phase 2 shared utilities — types + utils extraction (2026-05-23)

**Created:** All Phase 2 files under `src/frontend/shared/` — types barrel, utils barrel, `vitest.frontend.config.ts`, and `slots.test.ts` (12/12 passing).

**Key divergences and decisions:**
- `manage-booking.js` `getSlotsForDate` is more defensive than the `booking-form.js` copy — canonical uses manage-booking approach: explicit `tenantConfig` param, null-check on `open_time`/`close_time`, `Number()` coercion on `day_of_week`
- `is_closed` comes from D1 as `0`/`1` integers, not booleans — canonical handles both (`boolean | 0 | 1` type, truthy check in `getSlotsForDate`)
- `escapeHtml` in `formatting.ts` is explicitly `@deprecated` — must be deleted once all surfaces migrate to JSX
- `vitest.frontend.config.ts` uses `environment: 'node'` (not jsdom) — utils are pure functions, no DOM needed
- `isToday` intentionally duplicated between `slots.ts` (private, unexported) and `dates.ts` (exported) to keep `slots.ts` self-contained without a circular-ish intra-utils import

### Settings hash routing + accordion sidebar (2026-05-19)

**Changed:** Split `settings.html` into hash-routed sub-views with an accordion sub-navigation in the sidebar.

**Files modified:**
- `public/admin/settings.html` — replaced flat Settings tab with parent Settings button plus General / Opening Hours / Blocked Dates sub-items
- `public/admin/js/settings-page.js` — hash routing (`#general`, `#opening-hours`, `#blocked-dates`), active sub-nav syncing, accordion open/close
- `public/admin/js/settings.js` — exposed `window.BlockedDatesCalendar` and added `SettingsManager.initFormOnly(container)` for general form without other sections
- `public/admin/styles/admin.css` — `.tab-btn--parent`, `.tab-subnav`, `.tab-btn--sub` styles; mobile wraps under top nav row at ≤768px

**Key patterns:**
- `syncHash()` normalises missing/invalid hashes to `#general` with `history.replaceState(...)` — avoids reload, guarantees valid active state
- `SettingsManager.init()` stays backward-compatible; `initFormOnly()` reuses same form markup/listeners for General sub-page
- Mobile: `.sidebar-nav` `flex-wrap`s; `.tab-subnav` takes full width so Bookings/Settings stay on first row, submenu expands below

### Booking cancellation page (2026-05-19)

**Added:** `public/cancel.html`, `public/js/cancel.js`, shared standalone-page styles in `public/shared.css`.

**Key patterns:**
- Standalone public entry point: preload self-hosted Google Sans fonts, load `/shared.css`, `theme.js` blocking in `<head>`
- `cancel.js` reads `?id=` from URL, fetches `GET /api/reservations/:id`, renders four states: missing-link error, loading, loaded booking review, cancellation success
- Date formatting: `new Date(YYYY-MM-DD + 'T12:00:00Z')` with `timeZone: 'UTC'` to avoid timezone drift
- Delete flow: single-click, destructive button swaps to `Cancelling...`, disables during request, replaces card with success or re-renders with inline error

### Phase 1 infrastructure — Vite + tsconfig.frontend (2026-05-23)

**Created:** `vite.config.ts` and `tsconfig.frontend.json` as the frontend build foundation for the Preact migration.

**Key decisions locked in:**
- `@preact/preset-vite` plugin; multi-entry build: `booking-widget`, `manage-booking`, `admin` all under `src/frontend/`
- Output dir `dist/` — consumed by Wrangler `assets.directory`
- Dev server port `5173`; `/api` proxied to `localhost:8787` for same-origin API calls during dev
- Path aliases `@frontend` → `src/frontend/`, `@shared` → `src/frontend/shared/` — must stay in sync with `tsconfig.frontend.json` paths
- `tsconfig.frontend.json` uses `moduleResolution: Bundler` (not Node) — required for Vite; `jsxImportSource: preact` for automatic JSX runtime; `noEmit: true` (Vite emits, tsc type-checks only)
- `tsconfig.frontend.json` scoped to `src/frontend/**` — does not overlap with the worker `tsconfig.json`

### manage-booking.js — booking management page (2026-05-21)

**Added:** `public/js/manage-booking.js` — self-contained ES module (~390 lines) for `public/booking/manage/index.html`. Post-delivery dietary_requirements bug fixed by Coordinator (line ~408).

**Architecture:**
- Single module-scoped `state` object; no global leakage
- Eight explicit views rendered into `#cancel-app`: `loading`, `error`, `overview`, `edit-details`, `change-datetime`, `cancel-confirm`, `success-edit`, `success-cancel`
- All rendering: imperative `.innerHTML` followed by event listener attachment

**Calendar reuse:**
- Imports `renderCalendarGrid`, `MONTHS` from `./calendar-core.js`
- `isDateUnavailable` combines past-date check, `blockedDates` Set, AND tenant `opening_hours` closed-day check
- Tooltip logic (`showBlockedTooltip`, `dismissTooltip`, `handleOutsideClick`) ported from `calendar.js` but uses local `calContainer` reference (not `document.getElementById`) — safe for dynamic DOM
- `state.calYear`/`state.calMonth`/`state.selectedDate` initialised from reservation's `reservation_date` so calendar opens on correct month with booking date selected

**Time slot generation:**
- `generateSlots`, `getSlotsForDate`, `isToday`, `getEarliestTodaySlot`, `getAvailableSlots` replicated from `booking-form.js` with explicit `tenantConfig` parameter (not imported singleton) — pure functions
- Fallback: null `tenantConfig` → `getSlotsForDate` returns `generateSlots('12:00', '22:00')`

**API dependencies:**
- `GET /api/reservations/:id` — init; `GET /api/tenants/:tenantId` — non-fatal; `GET /api/reservations/blocked-dates?tenant_id&month`; `GET /api/reservations/blocked-times?tenant_id&date&guests`; `PATCH /api/reservations/:id`; `DELETE /api/reservations/:id`

**Key patterns:**
- `state.editData` updated from live form values before each PATCH — re-render after failure shows what user typed, not stale loaded values
- `inlineErrorHtml(message)` and `detailsHtml(reservation)` are pure HTML helpers
- All fetch calls wrapped in try/catch; `patchReservation` and `deleteReservation` return bool; callers check result
- `is_closed` treated as boolean via JS truthiness (SQLite 0/1 maps correctly)
- No inline styles except tooltip pixel positioning (computed from `getBoundingClientRect`)

