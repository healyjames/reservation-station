# Squad Decisions

## Active Decisions

### 2026-05-14: Font loading — preload hints
**By:** Twinkie (Frontend Dev)
**What:** All three HTML entry points (`public/index.html`, `public/admin/index.html`, `public/admin/dashboard.html`) now include `<link rel="preload">` hints for both self-hosted variable font files before their stylesheet links. `font-display: swap` retained in `shared.css`.
**Why:** `@font-face` rules live in `shared.css` discovered only after the full `@import` chain resolves. Fonts were not requested until that chain completed, creating a download gap that caused visible FOUT with `font-display: swap`. Preload moves font requests to first-HTML-parse time.

### 2026-05-14: Admin date picker and calendar-core extraction
**By:** Twinkie (Frontend Dev)
**What:** Extracted shared calendar grid rendering into `public/js/calendar-core.js` (ES module exporting `MONTHS`, `DAY_NAMES`, `renderCalendarGrid`). Added `public/admin/js/date-picker.js` (plain IIFE, `window.DatePicker`) to make the admin date display clickable with a popup calendar. `calendar.js` updated to import from `calendar-core.js`. `renderCalendarGrid` is class-name agnostic via `cellClass`/`headerClass` options — defaults to `dp-day`/`dp-day-name`; public widget passes `calendar-day`/`day-name`. Popup appended to `document.body`, `position: fixed`. Past dates get `.past` class but remain clickable in admin. `isDisabled` is now separate from the `past` class.
**Why:** Admin dashboard needed arbitrary date navigation without clicking prev/next many times. Extraction avoids code duplication between public widget and admin picker.

### 2026-05-14: BlockedDates UI migration
**By:** Twinkie (Frontend Dev)
**What:** Removed the global "Block same-day bookings" toggle from settings form. Added per-day block toggle to admin dashboard in `#day-block-container` (between `.bookings-overview` and `#bookings-list`). Toggle uses optimistic UI; reverts on API error. `apiFetch` updated to merge `headers` from options (backward-compatible). Public calendar `renderCalendar` made async; `fetchBlockedDates(year, month)` added; blocked dates stored in module-level `Set<string>`; fetched once per month navigation; fails open.
**Why:** `block_current_day` replaced by `BlockedDates` table. Block control moved to per-day in the day view rather than a global setting. Calendar widget must grey blocked dates for bookability.

### 2026-05-14: BlockedDates API implementation
**By:** Sean (Backend Dev)
**What:** Migration `0004_blocked_dates.sql`: creates `BlockedDates(id, tenant_id, date, start_time, end_time, reason, created_date)` with compound index `(tenant_id, date)`; drops `block_current_day` from Tenants. `src/routes/blocked-dates.ts`: new Hono router, `adminAuth` via `blockedDates.use('*', adminAuth)`, endpoints `GET /?date=`, `POST /`, `DELETE /date/:date`, `DELETE /:id`. `GET /api/reservations/blocked-dates?tenant_id=&month=YYYY-MM` added to reservations router. `GET /blocked-times` updated: full-day block → all slots (short-circuit); time-range blocks merged with capacity blocks. `POST /reservations` checks `BlockedDates` for full-day block instead of `block_current_day`. `src/app.ts` mounts the new router. `DELETE /date/:date` registered before `DELETE /:id` to prevent route conflict.
**Why:** `block_current_day` was a coarse boolean. Tenants need holiday closures (specific dates) and partial-day blocks (private hire). Full-day blocks gate new bookings without cancelling existing ones.

### 2026-05-17: BlockedDates system architecture
**By:** Han (Lead)
**What:** Defined `BlockedDates` table schema and full API contract replacing `block_current_day`. Full-day block = `start_time IS NULL AND end_time IS NULL`; partial block = explicit `[start_time, end_time)` range; multiple rows per date allowed. `block_current_day` removed from `TenantSchema` and `Tenants`. `BlockedDateSchema`, `CreateBlockedDateSchema`, `BlockedDate`, `CreateBlockedDate` added to `src/db/schema.ts`. Admin endpoints: `GET/POST /api/admin/blocked-dates`, `DELETE /api/admin/blocked-dates/date/:date`, `DELETE /api/admin/blocked-dates/:id`. Public endpoint: `GET /api/reservations/blocked-dates?tenant_id=&month=YYYY-MM` returns `{ blocked_dates: string[] }` of full-day blocked dates. Dashboard toggle maps to `POST /` (block) and `DELETE /date/:date` (unblock). Calendar widget fetches per month — single request per navigation.
**Why:** `block_current_day` had no date flexibility, no time-range support, and no per-date targeting. Required for holiday closures and partial-day private hire.

### 2026-05-18: Blocked day tooltip UI
**By:** Twinkie (Frontend Dev)
**What:** Blocked days in the public booking calendar widget are now visually distinct from past days, and clicking them shows a tooltip instead of opening the booking form. `.calendar-day--blocked` uses diagonal stripe background (`repeating-linear-gradient(-45deg, ...)` with `--background-light`/`--background` tokens), `opacity: 0.55`, `cursor: not-allowed`. Click or keyboard (Enter/Space) appends a `<div role="tooltip" aria-live="polite">` to `#calendar-container` with "Bookings currently unavailable for this date"; auto-dismisses after 3 seconds or on next document click. `renderCalendarGrid` gained two new options: `isBlocked: (y, m, d) => bool` and `onBlockedSelect: (y, m, d, cell) => void` — both default to no-ops, keeping the admin date picker unaffected. In `calendar.js`, `isBlocked` wired to `blockedDates.has(dateStr)` and `onBlockedSelect` calls `showBlockedTooltip(cell)`. `setTimeout(..., 0)` defers the dismiss listener to prevent the triggering click closing the tooltip immediately. `showBlockedTooltip` is fully `try/catch` guarded — fail open. `pointer-events: none` on tooltip prevents it intercepting the dismiss click. Files changed: `public/js/calendar-core.js`, `public/js/calendar.js`, `public/styles.css`.
**Why:** Blocked dates needed to be visually "intentionally closed" (not just greyed like past dates), and users needed feedback on why their click did nothing.

### 2026-05-18: Opening Hours architecture
**By:** Han (Lead)
**What:** Defined `OpeningHours(id, tenant_id, day_of_week INTEGER 0–6, is_closed INTEGER 0/1, open_time TEXT HH:MM, close_time TEXT HH:MM)` table with `UNIQUE(tenant_id, day_of_week)` and `ON DELETE CASCADE`. `day_of_week` follows `Date.getDay()` / SQLite `strftime('%w')` encoding (0=Sunday). Invariant: `is_closed=1` → both times NULL; `is_closed=0` → both times non-NULL (route layer enforces; CHECK covers domain only). Default when no rows: all days open, 12:00–21:30. `generateTimeSlots(openTime='12:00', closeTime='22:00')` — `22:00` exclusive upper bound preserves last slot `21:30`. Admin endpoints `GET/PUT /api/admin/opening-hours` (PUT = atomic D1 batch: DELETE + 7 INSERTs, exactly 7 entries). `GET /api/tenants/:tenant_code` additive: `opening_hours` field (array or null). `GET /api/reservations/blocked-dates` additive: unions dates where DOW is closed (application-layer enumeration of month). `GET /api/reservations/blocked-times` additive: fetches DOW row, `is_closed=1` → all slots blocked, row with times → `generateTimeSlots(open, close)`, no row → defaults. Frontend: `getSlotsForDate(dateStr)` replaces `TIME_SLOTS` constant; reads `tenantConfig.opening_hours` by `Date.getDay()` from `T00:00:00`. Settings UI: 7-row table (Mon→Sun), closed checkbox disables time inputs, single Save button, GET on init, PUT on save.
**Why:** Hardcoded 12:00–21:30 window and all-days-open assumption had to be configurable per tenant. Zero migration risk for existing tenants — no rows = old behaviour.

### 2026-05-18: Opening Hours backend implementation
**By:** Sean (Backend Dev)
**What:** Migration `0005_opening_hours.sql`: creates `OpeningHours` table (no seed rows — backward compat in code). `src/db/schema.ts`: added `OpeningHoursEntrySchema`, `UpsertOpeningHoursSchema` (exactly 7 entries, `is_closed` accepts `boolean | 0 | 1`), `OpeningHoursEntry` type. `src/utils/slots.ts`: `generateTimeSlots(openTime='12:00', closeTime='22:00')` — exclusive upper bound; defaults preserve 12:00–21:30. `src/routes/opening-hours.ts`: Hono router, `adminAuth`, `GET /` returns `{ success: true, data: [] }`, `PUT /` validates open/close times when not closed, D1 batch for atomic replace (DELETE + 7 INSERTs). `src/app.ts`: mounted at `/api/admin/opening-hours`. `src/routes/tenants.ts` `GET /:id`: second query fetches opening hours, returned as `opening_hours` field (array or null). `src/routes/reservations.ts` `GET /blocked-dates`: queries closed DOWs from `OpeningHours`, enumerates month dates in application code, unions with `BlockedDates` full-day rows. `src/routes/reservations.ts` `GET /blocked-times`: fetches DOW row; `is_closed=1` → all default slots returned as blocked; otherwise uses `generateTimeSlots(open_time, close_time)` throughout capacity logic.
**Why:** Tenants need to define regular weekly opening hours so the booking widget only offers valid slots and hides closed days in the calendar.

### 2026-05-18: Opening Hours frontend implementation
**By:** Twinkie (Frontend Dev)
**What:** `public/admin/js/settings.js` — new `OpeningHoursManager` IIFE renders 7-row schedule table (UK order Mon→Sun, DOW 1→0) between settings form and blocked dates calendar. Each row: day name, closed checkbox, open/close time `<input type="time">`. Closed checkbox triggers `_applyClosedState(row)` — toggles `disabled`, adjusts `.oh-times` opacity (no full re-render). Default values: open=12:00, close=22:00. `GET /api/admin/opening-hours` populates on init; empty array keeps defaults. `PUT /api/admin/opening-hours` sends all 7 rows; `open_time`/`close_time` are `null` when `is_closed: true`. Success/error banner reuses `.alert`/`.alert-success`/`.alert-error`. 401 → `AdminAuth.logout()`. `window.OpeningHoursManager` declared before `SettingsManager` (called synchronously in `SettingsManager.init()`). `public/js/booking-form.js` — `TIME_SLOTS` constant replaced with `generateSlots(openTime, closeTime)` (30-min intervals, exclusive upper bound) and `getSlotsForDate(date)` (reads `tenantConfig.opening_hours` by DOW using `getUTCDay()` on `T12:00:00Z` ISO string to avoid timezone drift; returns `[]` for closed days; falls back to `generateSlots('12:00', '22:00')` when `opening_hours` null/empty). `public/admin/styles/admin.css` — `.oh-*` CSS block; responsive: ≤640px collapses to 2-column 2-row grid. CSS variable mapping: spec's `--text-primary`/`--text-secondary`/`--surface` mapped to `--foreground`/`--foreground-darker`/`--background`.
**Why:** Opening hours are more fundamental than blocked dates; dynamic slot generation from `tenantConfig.opening_hours` means the widget automatically respects the restaurant's schedule without additional API calls.

### 2026-05-18: Opening Hours test suite
**By:** Neela (Tester)
**What:** Created `test/opening-hours.spec.ts` with 19 tests across 5 suites: (1) `GET /api/admin/opening-hours` — 401 guard, empty state, ordered results; (2) `PUT /api/admin/opening-hours` — 401 guard, body-length validation, missing-time validation, save 7 days, replace on second PUT, closed day null times; (3) `GET /api/tenants/:tenant_code` — `opening_hours: null` when unconfigured, array when configured; (4) `GET /api/reservations/blocked-dates` — empty state, closed DOW dates included, union with explicit blocked dates, tenant isolation; (5) `GET /api/reservations/blocked-times` — all slots blocked for closed day, no extra blocks for open day, backward compat when no rows. UUID ranges: tenants `000000001001–000000001002`, admin user `000000001101`, opening hours rows `000000001200–000000001206`, blocked date `000000001300`. January 2099: starts Thursday (DOW 4); Sundays (0) on 5, 12, 19, 26; Mondays (1) on 6, 13, 20, 27. `clearDb` wraps `DELETE FROM OpeningHours` and `DELETE FROM BlockedDates` in `.catch(() => {})`. Suite 5 uses `max_guests: 0` (unlimited) to isolate from capacity logic. `is_closed` asserted as integer `1` from GET (D1 returns booleans as integers). `makeAllOpenHours()` helper generates 7-entry array (days 0–6, open 12:00–22:00) for PUT body construction.
**Why:** Tests written ahead of implementation to define the contract. Closed-day behaviour observable via both `blocked-dates` (date string) and `blocked-times` (20 slots). Open-day slot-window constraint not directly testable via `blocked-times` (out-of-window slots never generated, not marked blocked) — Suite 5 focuses on observable: closed-day full-block and no-op for open days.

### 2026-05-21: manage-booking page rename from cancel
**By:** Twinkie (Frontend Dev)
**What:** Rename the standalone public booking management entrypoint from `public/cancel.html` / `public/js/cancel.js` to `public/manage-booking.html` / `public/js/manage-booking.js`, while keeping the current in-place edit-and-cancel experience unchanged.
**Why:** The page now handles both editing and cancellation, so the URL and asset names should describe the broader purpose. Matching the file names to the UI wording reduces confusion when linking to the page from future emails or docs.
**Notes:** Keep the existing `#cancel-app` mount id for now so the rename stays path-focused and does not force unrelated JS/template churn. Preserve the current standalone shared-style approach in `public/shared.css`.

### 2026-05-21: manage-booking.js module architecture
**By:** Twinkie (Frontend Dev)
**What:** `public/js/manage-booking.js` is a self-contained ES module that owns the full booking management UX at `/booking/manage/`. Renders into `#cancel-app` exclusively via imperative `.innerHTML` assignment followed by event listener attachment — no virtual DOM, no framework. Single module-scoped `state` object drives all rendering. Explicit views: `loading`, `error`, `overview`, `edit-details`, `change-datetime`, `cancel-confirm`, `success-edit`, `success-cancel`. Calendar reuse: imports `renderCalendarGrid` and `MONTHS` from `./calendar-core.js`. Slot generation functions (`generateSlots`, `getSlotsForDate`, `isToday`, `getEarliestTodaySlot`, `getAvailableSlots`) inlined with explicit `tenantConfig` parameter rather than importing from `booking-form.js` (which consumes a module-singleton). `state.editData` updated from live form values before each PATCH attempt so re-render after failure shows what the user typed. `loadTenant` is non-fatal; null `state.tenantConfig` allowed; `getSlotsForDate` falls back to `generateSlots('12:00', '22:00')`.
**Why:** Manage-booking is a distinct entry point with different context from `booking-form.js`. Explicit `tenantConfig` parameter makes slot helpers pure functions easier to reason about in a multi-view state machine.

### 2026-05-21: manage-booking calendar — blocked-day parity (superseded)
**By:** Twinkie (Frontend Dev)
**What:** Keep `/booking/manage/` on the shared `renderCalendarGrid` core instead of duplicating the homepage calendar, and make its Step 1 date picker match the homepage's blocked-day behaviour. Fetch blocked dates using the resolved tenant id. Blocked and closed days should stay striped, disabled, and show the same tooltip copy as the homepage calendar. Keep the existing `dp-day` / `dp-day-name` class structure in `public/shared.css`.
**Notes:** Superseded by the calendar rework decision below.

### 2026-05-21: manage-booking calendar — createCalendar factory proposal (superseded)
**By:** Twinkie (Frontend Dev)
**What:** Refactor `public/js/calendar.js` into a reusable `createCalendar(containerEl, options)` factory and make manage-booking Step 1 mount that same public calendar. Keep backward-compatible auto-init IIFE in `calendar.js` guarded so importing it on non-homepage pages does nothing. `public/shared.css` aliases the public widget's `.calendar-day` / `.day-name` selectors to existing standalone date-picker styling.
**Why:** Reusing the same tooltip, blocked-date fetch, and month-navigation logic cuts frontend maintenance and keeps booking/edit flows visually consistent.
**Notes:** Superseded by the calendar rework decision below.

### 2026-05-21: manage-booking calendar — final approach (stop rebuilding on selection)
**By:** Twinkie (Frontend Dev)
**What:** Keep `/booking/manage/` Step 1 on the shared homepage calendar contract, but stop rebuilding the calendar on date selection. `public/js/calendar.js` caches unavailable dates per `YYYY-MM` inside each calendar instance so month re-renders reuse the same blocked set. `public/js/manage-booking.js` updates only the selected-date label, helper text, and Next button when availability or selection changes. `public/shared.css` already contains the calendar container, nav, grid, and blocked-day styles — no extra stylesheet link needed. The manage-page host renders `role="region"` on `#edit-calendar-host` to match the homepage accessibility structure.

### 2026-05-21: manage-booking unavailable dates
**By:** Twinkie (Frontend Dev)
**What:** Treat manage-booking unavailable dates exactly like the main widget: build the month's unavailable set from both `/api/reservations/blocked-dates` and tenant `opening_hours`; feed that same data into the shared calendar renderer for blocked styling/tooltips; block the edit flow from advancing when the currently selected date is unavailable.
**Files:** `public/js/calendar.js`, `public/js/manage-booking.js`

### 2026-05-21: GET /api/tenants/:id accepts UUID or tenant_code
**By:** Sean (Backend Dev)
**What:** `GET /api/tenants/:id` now accepts either a UUID or a `tenant_code` slug as the `:id` parameter. Detection uses `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. When matched, the query uses `WHERE id = ?`; otherwise it falls back to `WHERE tenant_code = ?`. Response shape is unchanged: full tenant row plus `opening_hours` array (or null).
**Why:** The manage-booking page holds a `tenant_id` UUID from the reservation record, not a `tenant_code`. The endpoint needed to serve both the embeddable widget (which uses `tenant_code`) and the manage-booking flow (which uses UUID).
**Notes:** A `tenant_code` that coincidentally matches the UUID regex would be routed to the UUID branch and return 404. Theoretical collision only — in practice tenant codes are short slugs. Acceptable risk.

### 2026-05-21: Booking update availability validation (proposed)
**By:** Sean (Backend Dev)
**What:** Extract a shared reservation-availability validator in `src/routes/reservations.ts` and use it for both public reservation creation and public reservation edits. The public `PATCH /api/reservations/:id` route was updating rows without checking blocked dates or closed days. PATCH must load the existing reservation first so validation can use the reservation tenant and exclude the current reservation from capacity checks. Non-availability edits (name, phone, dietary requirements) should still save without revalidating the unchanged booking slot. Validator should cover: full-day blocks, closed days, opening-hours slot range, partial blocked times, max covers, and concurrent guest limits. Validation failures return the existing public error field.
**Why:** Manage-booking users could move a reservation onto an unavailable date. Reusing one validator keeps POST and PATCH aligned on tenant-aware booking rules without duplicating date logic.
**Status:** Proposed — not yet implemented.

### 2026-05-21: manage-booking page review — approved
**By:** Neela (Tester)
**What:** Reviewed Sean's `GET /api/tenants/:id` UUID/tenant_code change and Twinkie's `manage-booking.js`. Both approved. UUID regex correct and complete including `/i` flag. State machine covers all 8 views cleanly. Calendar reuse verified: `renderCalendarGrid`, blocked dates, opening hours, tooltip all match main widget. `getAvailableSlots` / today filtering logic correct. Edit details form uses `checkValidity()` + `reportValidity()`. `dietary_requirements` sends `''` on clear. All six fetch callsites wrapped in try/catch. XSS review: all API data passes through `escapeHtml()` — no vulnerabilities found. `state.view` noted as dead state (no functional impact). Minimum party size of 2 matches `booking-form.js` — consistent design decision, not a bug. Tenant_code matching UUID regex is theoretical-only acceptable risk.
**What (tests):** Two new test cases added to `test/index.spec.ts`: returns tenant by tenant_code; 404 for unknown tenant_code. `seedTenant` in that file updated to include `tenant_code`. Existing tests unaffected.

### 2026-05-21: manage-booking PATCH test coverage
**By:** Neela (Tester)
**What:** Extended `test/reservations-edit.test.ts` with: passing-path coverage for updating to an open future date (`2099-11-19`); rejection-path coverage for updating to a full-day blocked date; rejection-path for updating to a closed day from `OpeningHours`; regression coverage that non-date field edits still succeed when reservation remains on a valid date. `seedBlockedDate()` helper added. `clearDb()` extended to include `BlockedDates` cleanup. Past-date PATCH coverage not added — reservation creation contract does not currently reject past dates; parity unclear until that rule exists. Test execution rejected by environment with `No, ignore tests`.

### 2026-05-22: Frontend framework revised — Preact + TypeScript (TSX)
**By:** Han (Lead Architect)  
**What:** Migrating the frontend (booking widget + admin dashboard) from vanilla ES modules to Preact + TypeScript (TSX). The original 2026-04-01 "no framework dependencies" constraint is revised to read: "no *runtime* framework dependencies on the embedding page." Preact satisfies this constraint — it compiles to self-contained JS bundles with no host-page runtime dependency. Widget bundle and admin bundle must remain separate (different Vite entrypoints). Bundle overhead: Preact ~3KB gzip — acceptable for a booking widget.  
**Why:** ~1,500 lines of frontend JS with zero type safety, duplicated utilities (4× `escapeHtml`, 2× slot generators, 2× `formatDate`), imperative DOM mutation with manual listener lifecycle, and no frontend tests. James has React familiarity; Preact provides full React API compat at 1/15th the bundle size. Migration assessed as feasible with no fundamental blockers.

### 2026-05-22: Preact — state management choices
**By:** Han (Lead Architect)  
**What:** Widget uses Preact Signals (`@preact/signals`) — fine-grained reactivity, ~2KB, no context threading. Key signals: `selectedDate`, `guests`, `blockedTimes`, `step`. Admin uses `useState` + `useReducer` — more complex state (reservation list, modal state, settings) but no library warranted. No Zustand/Redux/MobX/Jotai.  
**Why:** Widget has clear reactive dependencies (date change → fetch blocked times → update slots). Signals match this perfectly. Admin state is page-scoped with no cross-component sharing that requires a store.

### 2026-05-22: Preact — build tool: Vite with @preact/preset-vite
**By:** Han (Lead Architect)  
**What:** Vite is the build tool. `@preact/preset-vite` handles JSX transform, tsconfig, and HMR. Multi-page app (MPA) config in `vite.config.ts` with separate `input` entrypoints for widget, cancel, manage-booking, and admin. esbuild under the hood for transforms; Rollup for bundling. Worker build (via Wrangler/esbuild) remains fully independent — do not merge the two pipelines.  
**Why:** First-class Preact support, multi-page app support, CSS modules, HMR, and asset fingerprinting built in. Vite is the standard choice for Preact projects.

### 2026-05-22: Preact — theme.js must remain a blocking script
**By:** Han (Lead Architect)  
**What:** `theme.js` must remain as a separate non-module, non-deferred `<script>` in `<head>` of all HTML templates, loaded before the Preact bundle. It applies CSS custom properties to `document.documentElement` from URL params before first paint. If it is bundled or deferred, CSS variables will not be set when the Preact root mounts, causing FOUC. Hard rule: `theme.js` is never included in the Vite bundle.  
**Why:** Preventing flash of incorrect theme (FOICT) requires synchronous execution before any rendering. The Preact bundle tag must follow `theme.js` in `<head>`.

### 2026-05-22: Preact — calendar-core migration constraint
**By:** Han (Lead Architect)  
**What:** Widget and admin must be migrated together before the vanilla files are deleted. Admin scripts (`date-picker.js`, `settings.js`) do `import('/js/calendar-core.js')` at a URL path. If `calendar-core.js` is moved into a compiled Preact component without migrating admin, those dynamic imports break. `calendar-core.js` becomes the shared `CalendarGrid.tsx` component. Both surfaces must be on Preact before the vanilla files are removed.  
**Why:** Shared dynamic import creates a coupling between widget migration and admin migration. The canonical shared component replaces the vanilla module — both consumers must be ready.

### 2026-05-22: Preact — incremental migration strategy (4 phases)
**By:** Han (Lead Architect)  
**What:** Phase 1 (Infrastructure): Install Vite, `@preact/preset-vite`, `preact`, `@preact/signals`, TypeScript types; create `vite.config.ts`; create `tsconfig.frontend.json`; update `wrangler.jsonc` to point at build output; verify `wrangler dev` + `vite dev` with proxy end-to-end. Keep all vanilla JS working. Phase 2 (Shared utilities): `frontend/shared/types.ts`, `slots.ts`, `dates.ts`, `html.ts` — consolidate the duplicated copies. Phase 3 (Public widget): widget components, cancel page, manage-booking (most complex — 8-view state machine). Phase 4 (Admin): `auth.ts`, `BookingModal.tsx`, `DatePicker.tsx`, `Dashboard.tsx`, `Settings.tsx`. First PR scope: Phase 1 only.  
**Why:** Incremental migration allows both surfaces to remain stable throughout. Phase 1 gates everything else. First PR proves end-to-end deploy before any component code is written.

### 2026-05-22: Preact — directory structure
**By:** Twinkie (Frontend Dev) + Han (Lead Architect)  
**What:** All new Preact source lives under `src/frontend/` with subdirectories: `booking-widget/`, `cancel/`, `manage-booking/`, `admin/`, `shared/`. Shared components in `src/frontend/shared/components/` (CalendarGrid, DayCell, BlockedTooltip, LoadingSpinner, MessageCard, BookingDetailsList, StandaloneLayout). Shared types in `src/frontend/shared/types/` (index.ts, reservation.ts, tenant.ts, calendar.ts). Shared utils in `src/frontend/shared/utils/` (dates.ts, slots.ts, formatting.ts). Vite build outputs to `public/dist/` (or `dist/` per Sean's wrangler recommendation). All existing backend `src/` files are unchanged.  
**Why:** Clean separation between Worker code and frontend code. Shared directory eliminates duplication across surfaces. Existing `src/` tree is not disturbed.

### 2026-05-22: Preact — CSS strategy
**By:** Twinkie (Frontend Dev)  
**What:** CSS Modules (`.module.css`) for booking widget, cancel page, and manage-booking page — widget is embeddable; CSS Modules prevent class name conflicts with host-page CSS. Admin dashboard uses plain CSS or CSS Modules (no host-page conflict risk). Design tokens (`shared.css` — CSS custom properties on `:root`) remain as global CSS, imported once at the top-level entry. Not scoped. CSS Modules scope class names, not CSS variable resolution — themed `var(--primary)` etc. work normally inside modules. No Tailwind — existing CSS is token-based and carefully crafted; utility-class rewrite not warranted.  
**Why:** Embeddable widget requires scoped class names. Admin is a standalone app. Tokens must cascade globally. Existing CSS migrates with minimal risk.

### 2026-05-22: Preact — wrangler.jsonc changes
**By:** Sean (Backend Dev)  
**What:** Two changes to `wrangler.jsonc`: `assets.directory` → `./dist` (from `./public`); add `"not_found_handling": "single-page-application"` to enable SPA client-side routing without a `_redirects` file. Everything else (D1 binding, compatibility flags, observability) is unchanged. Alternative if `not_found_handling` is unavailable: add `_redirects` with `/* /index.html 200` to Vite's `public/` dir.  
**Why:** Vite outputs built assets to `dist/`. SPA routing requires the server to return `index.html` for all unmatched paths. `not_found_handling: "single-page-application"` is the Cloudflare Workers Static Assets native mechanism for this.

### 2026-05-22: Preact — tsconfig split
**By:** Sean (Backend Dev)  
**What:** Split `tsconfig.json` into: (1) `tsconfig.json` — Worker only, `lib: ["ESNext"]`, no DOM, `include: ["src/**/*.ts", "test/**/*.ts", "worker-configuration.d.ts"]`; (2) `tsconfig.frontend.json` — Preact app, `lib: ["ESNext", "DOM", "DOM.Iterable"]`, `jsx: "react-jsx"`, `jsxImportSource: "preact"`, `include: ["frontend/src/**/*.ts", "frontend/src/**/*.tsx", "src/shared/**/*.ts"]`. `@preact/preset-vite` injects `jsxImportSource: "preact"` automatically for `.tsx` files — the tsconfig setting is for IDE correctness.  
**Why:** Adding DOM types to the Worker tsconfig is semantically wrong. Split avoids polluting the Worker build with browser globals and gives the frontend project correct JSX resolution.

### 2026-05-22: Preact — shared type surface (`src/shared/types/index.ts`)
**By:** Sean (Backend Dev)  
**What:** Create `src/shared/types/index.ts` that re-exports inferred types from `src/db/schema.ts` (`Tenant`, `CreateTenant`, `UpdateTenant`, `Reservation`, `CreateReservation`, `UpdateReservation`, `BlockedDate`, `CreateBlockedDate`, `OpeningHoursEntry`, `LoginPayload`) and from `src/utils/slots.ts` (`SlotReservation`). Also defines API response envelope types: `ApiSuccess<T>`, `ApiError`, `ApiResponse<T>`, `BlockedDatesResponse`, `BlockedTimesResponse`, `AvailabilitySlot`, `AvailabilityResponse`, `LoginResponse`, `TenantWithOpeningHours`. Zod schemas stay Worker-side only — this module is type-only. Vite alias: `@shared` → `src/shared`.  
**Why:** Frontend needs typed API responses. Re-exporting inferred types (not Zod schemas) keeps the shared surface pure TypeScript with no runtime Worker dependency.

### 2026-05-22: Preact — no backend changes required
**By:** Sean (Backend Dev)  
**What:** Zero changes to API routes, D1 schema, or auth mechanism for the Preact migration. Auth (Bearer JWT from localStorage) is framework-agnostic. CORS (`cors()` wildcard) is unchanged — same-origin deployment means CORS is not enforced. Optional CORS hardening (explicit `allowHeaders: ['Authorization', 'Content-Type']`) is low-priority. All API calls use relative paths (`/api/...`) — no `VITE_API_BASE_URL` env var needed for same-origin deployment.  
**Why:** The clean JSON-only API surface means the frontend rewrite is a pure frontend concern. Backend is fully ready for Preact migration without any route, schema, or auth changes.

### 2026-05-23: Phase 3 Layers A/B/C/E components complete
**By:** Twinkie (via Coordinator)
**What:** 12 shared Preact components built in `src/frontend/shared/components/`:
- Layer A (Form primitives): Button, Input, Select, Textarea, FormField
- Layer B (Feedback & status): Spinner, Alert, MessageCard
- Layer C (Layout & overlay): Modal, StandaloneLayout, BookingDetailsList
- Layer E (Admin toggle): ToggleSwitch

ToggleSwitch uses `data-checked` attribute strategy on the wrapper element (not `:has(input:checked)`) for reliable CSS Modules scoping and test environment compatibility.

Tests use `// @vitest-environment jsdom` file-level annotation. `@testing-library/preact` and `jsdom` were installed as devDependencies. Two jsdom behavior notes: `showModal()` not implemented in jsdom — guarded in Modal component; `fireEvent.click` bypasses disabled on form elements — guarded in Button and ToggleSwitch handlers.

Barrel `src/frontend/shared/components/index.ts` updated to include all Layer A/B/C/E exports alongside Han's existing Layer D exports.

**Why:** Phase 3 execution — shared component library for Phases 4–7.

### 2026-05-23: Phase 3 Layer D calendar components complete
**By:** Han (via Coordinator)
**What:** 5 calendar/domain Preact components built: Badge, SelectedDateInfo, DayCell, BlockedTooltip, CalendarGrid. DayCell uses style-injection pattern (receives CalendarGrid's CSS module object as prop). CalendarGrid is a direct Preact port of calendar-core.js — calendar-core.js MUST remain in public/js/ until Phase 7.
**Why:** Phase 3 execution — shared component library for Phases 4-7.

### 2026-05-24: Phase 4 cancel surface complete
**By:** Twinkie (via Coordinator)
**What:** Cancel surface built at `src/frontend/cancel/`. Entry point `cancel.tsx`, 4 views (`LoadingView`, `ErrorView`, `OverviewView`, `SuccessView`), `useCancelBooking` hook with `@preact/signals`. URL param confirmed as `?id=` (not `?ref=` as originally documented). Added cancel entry to `vite.config.ts`. Also added `src/frontend/vite-env.d.ts` (`/// <reference types="vite/client" />`) to resolve pre-existing CSS module type errors across all frontend components.
**Why:** Phase 4 execution — first Preact surface, validates the component library and deploy pipeline.

### 2026-05-24: Phase 5 booking widget complete
**By:** Twinkie
**What:** Booking widget built at `src/frontend/booking-widget/`. Entry point `booking-widget.tsx`, `BookingApp` root with 4 steps (`calendar`, `form-step1`, `form-step2`, `success`), 3 hooks (`useTenant`, `useAvailability`, `useBookingForm`), 4 views (`CalendarView`, `Step1FormView`, `Step2FormView`, `SuccessView`), type files (`booking.ts`, `availability.ts`). `BookingStep` type updated from doc's `1 | 2 | 'success'` to `'calendar' | 'form-step1' | 'form-step2' | 'success'`. Slot generation uses shared `getAvailableSlots()` from Phase 2. TypeScript compile clean on first run.
**Why:** Phase 5 execution — revenue-critical booking widget surface migration.

### 2026-05-24: Phase 6 manage-booking surface complete
**By:** Twinkie (Frontend Dev)
**What:** Manage-booking surface built at `src/frontend/manage-booking/`. Entry point `manage-booking.tsx`, `ManageApp` root with `Signal<ManageView>` routing 8 views (loading, error, overview, edit-details, change-datetime, cancel-confirm, success-edit, success-cancel). `useManageBooking` hook owns all state, API calls, and view transitions. Tenant loaded from `reservation.tenant_id` post-fetch — non-fatal; `tenantConfig` may be null throughout. Signal prop-drilling: hook returns `Signal<T>` objects; `ManageApp` passes them directly to views as `Signal<T>` props (views can both read and write `.value`). `isDateUnavailable` checks three conditions: past-date, `blockedDates`, and tenant `opening_hours` closed days (booking widget only checks two). `selectDate` pre-selects the reservation's original time if still available on the new date. PATCH/DELETE failures set `errorMessage.value` and stay on the current view — the `error` view is only for initial reservation load failure. TypeScript clean on first compile.
**Why:** Phase 6 execution — most complex public surface (8-view state machine, full edit/cancel flows).

### 2026-05-24: Phase 7 admin SPA complete — single Vite entry replacing 3 HTML pages
**By:** Twinkie (Frontend Dev)
**What:** Admin SPA built at `src/frontend/admin/`. One Vite entry (`src/frontend/admin/index.html`) replaces 3 vanilla HTML pages (`index.html`, `dashboard.html`, `settings.html`). View routing via signal: `'login' | 'dashboard' | 'settings'`. View detection on mount: no token → `'login'`; token + URL contains `settings` → `'settings'`; else → `'dashboard'`. Auth redirect `window.location.replace('/admin/?expired=1')` becomes `view.value = 'login'; auth.showExpiredBanner.value = true`. `AdminFetch` helper at `src/frontend/admin/utils/api.ts` centralises auth header injection. `useBookings` also manages day-block state (`isDayBlocked`, `toggleDayBlock`). 19 new files, 3 shared files modified. Zero TypeScript errors.
**Why:** Eliminates three `window.*` globals (`AdminAuth`, `BookingModal`, `DatePicker`) that were the primary source of tight coupling between HTML pages. Single bundle entry means zero risk of a page load where globals are missing. SPA view switching is faster than hard navigations. Completes the full Preact migration.

### 2026-05-24: Phase 7 CalendarGrid range selection — Option A
**By:** Twinkie (Frontend Dev)
**What:** Added hover/range props directly to `CalendarGrid` and `DayCell`. `CalendarGrid` new props: `isRangeStart`, `isInRange`, `isRangeEnd` (predicate functions), `onHoverDate` (callback), `onLeaveGrid` (callback). `DayCell` new props: `isRangeStart`, `isInRange`, `isRangeEnd` (booleans), `onMouseEnter` (callback). Range CSS classes added to `CalendarGrid.module.css`: `.rangeStart`, `.inRange`, `.rangeEnd`. All new props default to `undefined`/`false`. `BlockedDatesSettings` owns `rangeStart` and `hoverDate` signals; click logic: same-day → toggle, same-month → block range, different-month → toggle. Existing CalendarGrid usages (booking widget, manage-booking) are unaffected.
**Why:** Predicate function API is consistent with existing `isBlocked`/`isDisabled` pattern in CalendarGrid. Keeps `BlockedDatesSettings` in full control of range state. Safe defaults mean no changes required in non-admin contexts.

### 2026-05-27: Booking widget surface boundary
**Source:** `.squad/decisions/inbox/han-booking-widget-surface-boundary.md`

# Booking widget surface boundary

- **By:** Han
- **Date:** 2026-05-27
- **Decision:** `src/frontend/booking-widget/` remains a surface entry, not a shared component folder. `admin/`, `cancel/`, and `booking/manage/` are the same class of thing: standalone frontend surfaces with thin entries over `src/frontend/shared/`.
- **Details:** The correct split is surface entry vs reusable runtime code. Surface folders own `index.html`, bootstrap, bundle boundary, and page-level state. Reusable UI for the booking flow belongs under `src/frontend/shared/components/BookingWidget/`, which is already the case. The real cleanup target is not demoting `booking-widget`; it is removing the remaining ambiguity between legacy `public/` surfaces and the new Preact surfaces, then picking one canonical public booking entry.
- **Why:** This keeps deployable/public routes explicit, preserves thin-entry architecture, and avoids collapsing page-level concerns into shared component directories.

### 2026-05-26: Twinkie decision: audit token layer
**By:** Twinkie
**Date:** 2026-05-26
**Source:** `.squad/decisions/inbox/twinkie-audit-token-layer.md`

# Twinkie decision: audit token layer

## What
Added `public/frontend-audit.css` as a shared audit-compatibility layer, loaded after the legacy global stylesheets on every Preact entrypoint.

## Why
The CSS audit defines a newer token vocabulary (`--text-*`, `--surface-*`, `--border-*`, spacing/typography/shadow tokens) than the legacy theme system (`--foreground`, `--error`, older background tokens). Loading a compatibility layer lets Preact components consume the audited design tokens immediately while preserving the existing `theme.js` runtime overrides and older global styles.

## Impact
- All Preact entrypoints now receive the audited token set.
- Shared CSS modules can standardise on the audited semantic tokens.
- Legacy global styles remain functional during the transition.

### 2026-05-27: Twinkie decision: CSS dedupe shared boundaries
**By:** Twinkie
**Date:** 2026-05-27
**Source:** `.squad/decisions/inbox/twinkie-css-dedupe-shared-boundaries.md`

# Twinkie decision: CSS dedupe shared boundaries

- Removed the redundant `/shared.css` link from `src/frontend/admin/index.html` because `public/admin/styles/admin.css` already imports the shared stylesheet.
- Deleted the appended `frontend-audit.css` duplicate block from `public/styles.css`.
- Trimmed booking-widget-only and admin-only legacy selectors back out of `public/shared.css` so shared.css stays focused on tokens and genuinely shared primitives, while surface presentation remains in `styles.css` and `admin.css`.

### 2026-05-27: Twinkie decision: frontend audit merge
**By:** Twinkie
**Date:** 2026-05-27
**Source:** `.squad/decisions/inbox/twinkie-frontend-audit-merge.md`

# Twinkie decision: frontend audit merge

## What
Merged `public/frontend-audit.css` into the existing legacy stylesheets that define each Preact surface instead of choosing a single destination file:
- `public/styles.css` for the booking widget surfaces
- `public/shared.css` for shared standalone surfaces
- `public/admin/styles/admin.css` for the admin surface

## Why
The audit layer originally loaded *after* each surface's legacy stylesheet stack. Distributing the merged rules to the end of those existing files preserves that cascade order while letting us remove the extra `/frontend-audit.css` `<link>` from every Preact entry HTML file.

### 2026-05-27: Twinkie decision — root preact entry
**By:** Twinkie
**Date:** 2026-05-27
**Source:** `.squad/decisions/inbox/twinkie-root-preact-entry.md`

# Twinkie decision — root preact entry

## What
Made `src/frontend/index.html` the canonical built root entry by adding it to Vite's multi-entry inputs, then removed the retired vanilla `public/index.html` and other legacy public surface files that already had Preact replacements.

## Why
The repo had two competing public booking entry points: the old vanilla root page in `public/` and the Preact booking surfaces in `src/frontend/`. Building the root route from `src/frontend/index.html` removes that ambiguity while keeping the shared static CSS and `theme.js` assets that the Preact surfaces still use.

## Keep
`public/styles.css`, `public/shared.css`, `public/admin/styles/admin.css`, `public/js/theme.js`, and font assets remain live runtime dependencies for the Preact HTML entries.

### 2026-05-27: Shared-first frontend structure
**Source:** `.squad/decisions/inbox/twinkie-shared-first-frontend-structure.md`

# Shared-first frontend structure

- **By:** Twinkie
- **Date:** 2026-05-27
- **Decision:** Surface folders under `src/frontend/` stay entry-only. Shared runtime code now lives under `src/frontend/shared/`, including domain-specific hooks, types, components, and the admin fetch helper.
- **Details:** Former surface views were promoted into `shared/components/<Surface>/` and dropped the `View` suffix. To avoid the name collision between the former `SettingsView` page and the nested admin settings container, the page-level component stays `shared/components/Admin/Settings.tsx` and the nested shell is `shared/components/Admin/SettingsPanel.tsx`. The admin request helper moved to `shared/utils/adminFetch.ts` so `src/frontend/admin/` remains limited to `index.html`, `admin.tsx`, and `AdminApp.tsx`.
- **Why:** This keeps every surface as a thin composition layer, makes cross-surface imports consistent through `@shared/*`, and preserves a predictable naming scheme as more shared Preact code lands.

## Directives

### 2026-05-23T07-31-02: User directive
**By:** James Healy (via Copilot)
**What:** All write-ups, planning docs, and analysis markdown files must be placed in `./documentation/` — not the repo root, not `.squad/temp/`.
**Why:** User request - captured for team memory

### 2026-05-23T07-35-35: User directive
**By:** James Healy (via Copilot)
**What:** Agents must NEVER run any of the following git commands: `git add`, `git commit`, `git push`, `git merge`. No exceptions. All git operations are James's responsibility.
**Why:** User request - captured for team memory

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
