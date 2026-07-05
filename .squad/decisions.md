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

### 2026-05-21: AdminSidebar component extraction
**By:** Twinkie (Frontend Dev)
**What:** Extracted the duplicated `<nav>` sidebar into a new `AdminSidebar` Preact component at `src/frontend/shared/components/Admin/AdminSidebar.tsx` with its own CSS module `AdminSidebar.module.css`. The component accepts `activePage: 'bookings' | 'settings'`, `onGoBookings`, and `onGoSettings` props. It owns all sidebar state internally, including mobile open/close via `useSignal`. Desktop behaviour: sidebar renders as a static 200px flex column — identical to before, no visual change. Mobile behaviour (<768px): sidebar is `position: fixed`, off-screen left by default (`translateX(-100%)`), slides in with a 0.25s ease transition when open. A hamburger button (`☰`) is `position: fixed` top-left, z-index 60, only visible at `max-width: 767px`. It carries `aria-expanded` and `aria-controls="admin-sidebar-nav"` for accessibility. A semi-transparent overlay (`rgba(0,0,0,0.45)`, z-index 40) renders behind the sidebar when open; clicking it closes the sidebar. Files created: `AdminSidebar.tsx`, `AdminSidebar.module.css`. Files updated: `Dashboard.tsx` and `Settings.tsx` replaced their inline `<nav>` with the component; `Dashboard.module.css` and `Settings.module.css` had their `sidebar_nav`, `sidebar_logo`, and `tab_btn` rules removed (now owned by the component module).
**Why:** The nav was copy-pasted across Dashboard and Settings. Extracting it removes the duplication and centralises the mobile-responsive sidebar behaviour in one place.

### 2026-05-21: AdminSidebar review — approved
**By:** Han (Lead)
**Reviewer:** Han (Lead)
**Verdict:** ✅ APPROVED
**What:** Reviewed Twinkie's AdminSidebar extraction. All six criteria passed — correctness, code quality, CSS, accessibility, integration, no regressions. `aria-expanded`, `aria-controls`, `aria-label`, `aria-hidden`, and `aria-current="page"` all correct. Z-index stack (overlay 40, sidebar 50, hamburger 60) correct. Dashboard.module.css and Settings.module.css confirmed clean with no leftover sidebar class names.
**Non-blocking follow-up:** Hamburger `aria-label="Open navigation"` is static. When `isOpen` is true it should read "Close navigation". `aria-expanded` conveys state for screen readers, but updating the label dynamically is best practice: `aria-label={isOpen.value ? 'Close navigation' : 'Open navigation'}`.

### 2026-05-27: CancelConfirm CSS module extraction
**By:** Twinkie (Frontend Dev)
**What:** `src/frontend/shared/components/BookingManage/CancelConfirm.tsx` now uses `CancelConfirm.module.css` for `action_group`. Grepping `src/**/*.tsx` for `action-group` before the migration only found `CancelConfirm.tsx`, so `public/shared.css`'s `.action-group` rule now appears newly orphaned. Per the CSS-module extraction process, the global rule was left in place for James's cleanup pass and was not removed here.

### 2026-05-27: ChangeDateTime CSS module extraction
**By:** Twinkie (Frontend Dev)
**What:** Migrate `ChangeDateTime.tsx` to `ChangeDateTime.module.css` but keep the shared global selectors in `public/shared.css`/`public/styles.css` untouched for now. `action-group` is still consumed by other BookingManage components, while `calendar-container`, `calendar-header`, `calendar-nav`, `calendar-nav-btn`, `loading-indicator`, `compact-loading`, `inline-helper`, and `inline-helper-error` appear orphaned after this migration and should be cleaned up separately. `mt-2` is still present in `ChangeDateTime.tsx`, but no matching CSS rule was found in `public/shared.css` or `public/styles.css`.

### 2026-05-27: Error CSS module extraction
**By:** Twinkie (Frontend Dev)
**What:** `src/frontend/shared/components/BookingManage/Error.tsx` had no literal global class references, so it now uses a local `content` wrapper extracted from the existing `booking-form-content` rule in `public/styles.css`. `booking-form-content` is still used by `src/frontend/booking-widget/BookingApp.tsx`, so that global rule should remain for now. `error-container` in `public/styles.css` appears orphaned because there are no TSX consumers under `src/`.

### 2026-05-27: Loading CSS module extraction
**By:** Twinkie (Frontend Dev)
**What:** `src/frontend/shared/components/BookingManage/Loading.tsx` now uses `Loading.module.css` classes copied from the old `loading-indicator` and `compact-loading` globals. `loading-indicator` and `compact-loading` were found in `public/shared.css` and not in `public/styles.css`. Grepping `src/**/*.tsx` for those selectors found no remaining TSX consumers, so both globals now appear orphaned and can be cleaned up in a later pass.

### 2026-05-27: Booking widget mobile overflow fix
**By:** Twinkie (Frontend Dev)
**What:** Scope the booking widget sizing reset to `#booking-app` instead of relying only on the page-level global reset. Add a `#booking-app` border-box reset for all descendants plus `width: 100%; max-width: 100%;` on the root in `public/styles.css`.
**Why:** The widget contains `width: 100%` form controls/buttons, so if a host page omits or overrides the shared `box-sizing` reset, those controls can push the widget wider than the mobile viewport.

### 2026-05-28: Admin shared input adoption
**By:** Twinkie (Frontend Dev)
**Status:** Proposed
**What:** Admin forms should use the shared `FormField` + `Input` components instead of local raw `<input>` markup whenever they follow the standard stacked label-and-field pattern. Applied to `Login.tsx` and `GeneralSettings.tsx`. `OpeningHoursSettings.tsx` was intentionally skipped — its time controls require `step={1800}` for 30-minute increments, and the current shared `Input` interface does not support a `step` prop. Those specialised raw time inputs should remain in place until the shared input API is expanded deliberately. Reference pattern: `src/frontend/shared/components/Admin/BookingModal.tsx`.
**Why:** Keeps admin form markup consistent with BookingModal. Reuses shared accessibility and visual behaviour already handled by `FormField` and `Input`. Removes duplicate local input styling from admin CSS modules.

### 2026-05-29: Admin CSS modules use per-component local definitions
**By:** Twinkie (Frontend Dev)
**What:** Created a `.module.css` file per Admin component following the existing `BookingWidget/Step1Form.module.css` pattern. Covers all Admin components (`Login`, `Dashboard`, `Settings`, `DateNav`, `BookingCard`, `BookingCards`, `BookingModal`, `ReservationList`, `SettingsPanel`, `GeneralSettings`, `OpeningHoursSettings`, `BlockedDatesSettings`) plus `AdminApp`. Shared class names (e.g. `alert`, `form-group`, `loading-text`) are defined **locally** in each component's module rather than extracted to a shared module — consistent with the per-component module pattern already in use. `Settings.tsx` and `Dashboard.tsx` both use the sidebar layout classes; each got its own module with the shared layout styles duplicated rather than cross-importing. `modal-actions` in `BookingModal.tsx` remains a global string class — the `Modal` component's own styling handles footer layout. Responsive show/hide is defined in each component's module with `@media` queries. Zero global Admin class strings remain except `modal-actions` in `BookingModal.tsx`.
**Why:** Consistent with the per-component module pattern already in use across the project. Old global rules in `public/admin/styles/admin.css` for Admin component classes are now superseded and may be cleaned up in a future pass.

### 2026-05-30: Admin CSS module class naming convention
**By:** Twinkie (Frontend Dev)
**Status:** Applied
**What:** All CSS module class names in Admin components must use **underscores** for multi-word names, never camelCase. This is a firm rule from the `css-module-extraction` skill. All 12 Admin CSS module files and their paired TSX files were corrected. Examples: `.loginLayout` → `.login_layout`, `.sidebarNav` → `.sidebar_nav`, `.tabBtn` → `.tab_btn`, `.mainPanel` → `.main_panel`, `.toggleListItem` → `.toggle_list_item`. Applies to all files under `src/frontend/shared/components/Admin/*.module.css` and `src/frontend/admin/AdminApp.module.css`.
**Why:** The team's `css-module-extraction` skill explicitly states: "If a name needs more than one word, use underscores. Never use camelCase for CSS module class names." The original Admin CSS module extraction (2026-05-29) violated this rule.

### 2026-05-30: AdminHeader component extraction
**By:** Twinkie (Frontend Dev)
**What:** Extracted the shared `<header>` from `Dashboard.tsx` and `Settings.tsx` into a new `AdminHeader` component at `src/frontend/shared/components/Admin/AdminHeader.tsx` with props `{ venueName: string; onLogout: () => void }`. Created paired `AdminHeader.module.css` containing `.main_header`, `.header_brand`, `.btn_logout` rules moved from the two module files, plus a `@media (max-width: 767px)` rule setting `padding-left: calc(36px + var(--space-3) * 2)` to prevent the venue name being obscured by the `AdminSidebar` hamburger button. `Dashboard.tsx` and `Settings.tsx` now import and render `<AdminHeader venueName={venueName} onLogout={onLogout} />`. Removed the three header rules from `Dashboard.module.css` and `Settings.module.css`. Han reviewed and **approved** (see han-header-review decision).
**Why:** Both admin views had identical header markup and CSS. Single source of truth reduces drift risk, and the mobile padding fix could be applied once rather than duplicated.

### 2026-05-30: AdminHeader code review — approved
**By:** Han (Lead)
**Reviewer:** Han (Lead)
**Verdict:** ✅ APPROVED
**What:** Reviewed Twinkie's `AdminHeader` extraction. All criteria passed: props declared and destructured correctly; both consumers (`Dashboard.tsx`, `Settings.tsx`) wire without error; `id="venue-name"` preserved on brand span; `.main_header`, `.header_brand`, `.btn_logout` absent from both parent module files; mobile padding arithmetic (`calc(36px + var(--space-3) * 2)`) matches `AdminSidebar` hamburger dimensions exactly; no regressions in hook/signal/modal logic.
**Why:** Code review gate before shipping shared Admin component extraction.

### 2026-05-30: Daily capacity endpoint placement and validation (superseded)
**By:** Sean (Backend Dev)
**What:** Added `GET /api/reservations/daily-capacity` to `src/routes/reservations.ts` immediately after `/availability` and before `/:id` to prevent the parameterised route from capturing the literal path. Enforces strict `YYYY-MM-DD` validation. Product rule preserved: `max_covers = 0` means unlimited capacity — endpoint returns `{ max_covers: 0, booked_covers: 0, remaining_covers: null }` immediately without summing reservations.
**Why:** Route ordering must be explicit in Hono; literal segments must precede parameterised ones.
**Notes:** Superseded on 2026-06-12 by the rolling concurrent occupancy model; the `daily-capacity` endpoint was removed from the active capacity flow.

### 2026-05-30: Booking widget daily-capacity UI guardrails (superseded)
**By:** Twinkie (Frontend Dev)
**What:** Wired the booking widget `Step1Form.tsx` to the new `/api/reservations/daily-capacity` response. Guest dropdown is capped to `min(max_guests, remaining_covers)` when a finite daily capacity exists. Capacity warning shown only when the daily limit reduces the normal party-size ceiling. `remaining_covers < 2` replaces the guest selector with an inline sold-out / choose-another-date message. `remaining_covers: null` = unlimited — no warning or cap applied.
**Why:** Keeps UI aligned with the backend's daily cover limit; avoids advertising party sizes that cannot fit; gives guests a clearer explanation when the constraint comes from the day's remaining capacity.
**Notes:** Superseded on 2026-06-12 by the rolling concurrent occupancy model; `Step1Form` no longer consumes `dailyCapacity`.

### 2026-05-30: Vanilla JS → Preact frontend migration complete
**By:** Twinkie (Frontend Dev)
**What:** The frontend migration from vanilla JS to Preact is fully complete. All Preact components under `src/frontend/` use CSS Modules. `escapeHtml` shim deleted from `formatting.ts`. Orphaned global classes eliminated: `modal-actions` from `BookingModal.tsx` and `DeleteConfirmModal.tsx`; `booking-form-content` from `BookingApp.tsx`; `stack` from `BookingModal.tsx` and `Login.tsx`. `BookingDetailsList` is fully self-contained with `BookingDetailsList.module.css`. Build passes with zero TypeScript errors. No remaining global class dependencies in Preact component files.
**Why:** Completes the Preact migration started in May 2026.

### 2026-06-01: Email notifications architecture — transport, patterns, and scope
**By:** Han (Lead)
**What:** Nine architectural decisions for the Resend email notifications feature:
1. `sendEmail()` is transport-only: accepts `(env, { to, from, subject, html })`, does not choose templates or understand reservation events.
2. Route code uses `c.executionCtx.waitUntil(Promise.allSettled([...]))` for fire-and-forget — email failures never change API status codes.
3. A single joined SQL query (`Reservations r JOIN Tenants t ON t.id = r.tenant_id`) provides notification context for all three mutation handlers.
4. DELETE must fetch the joined row before deleting — the only way to preserve email context after row removal.
5. PATCH must fetch before update (404 check) and re-fetch after update — amendment emails use persisted state, not request body.
6. `contact_email` stays nullable in D1; Zod: `z.email().nullable().optional()` keeps tenant create/update backward-compatible.
7. `global_fetch_strictly_public` does not block Resend; normal outbound HTTPS `fetch()` works.
8. Platform subrequest limits (50 Free / 10 000 Paid) are not threatened by two outbound calls per reservation write.
9. Scope cut: do not normalise route response envelopes while wiring email. Keep existing public response contracts stable.
**Why:** Architecture review gate. Keeps the email layer additive, the booking writes authoritative, and the scope bounded.

### 2026-06-01: Email notifications backend implementation decisions
**By:** Sean (Backend Dev)
**What:** Implementation decisions for the email notifications feature:
- `sendEmail()` POSTs to `https://api.resend.com/emails`; throws on non-2xx so `Promise.allSettled` in callers absorbs failures.
- Each template file (`src/emails/*.ts`) is self-contained with local `detailsTable()` and `emailWrapper()` helpers (leemunroe inline-style pattern); no shared template module — avoids coupling. Brand primary `#266663`, body bg `#f6f6f6`, content bg `#ffffff`.
- All three mutation handlers use `c.executionCtx.waitUntil((async () => { ... })())` — immediately-invoked async IIFE — so HTTP response is never delayed.
- `contact_email` null guard: both emails skipped + `console.warn`; booking operations succeed regardless.
- PATCH: pre-fetch (joined) before UPDATE for 404 detection; re-fetch after UPDATE for amendment email state.
- DELETE: pre-fetch (joined) before DELETE so email context is available.
- `contact_email` added to `TenantSchema` as `z.string().email().nullable().optional()`. Migration `0006_tenants_contact_email.sql` adds the column.
- `RESEND_API_KEY` added to `Env` interface in `src/types/env.d.ts`; documented in `wrangler.jsonc`.
**Why:** Confirms implementation choices against Han's architecture guardrails.

### 2026-06-01: Email notification test coverage contracts
**By:** Neela (Tester)
**What:** Three test files authored ahead of implementation; 50 tests total.
- `test/email-util.spec.ts` (6 tests): `sendEmail` must POST to `https://api.resend.com/emails`, send `Authorization: Bearer` header, send correct JSON payload shape, reject on `ok === false`, resolve `undefined` on 200.
- `test/email-templates.spec.ts` (39 tests): all 6 template functions return non-empty `{ subject, html }`; `subject` includes tenant name; `html` includes `firstName`, `reservationDate`, `reservationTime`; `dietaryRequirements: null` must not render the literal string `'null'` (fallback required).
- `test/email-integration.spec.ts` (5 tests): POST/PATCH/DELETE return normal success codes even when Resend throws inside `waitUntil`; null `contact_email` skips dispatch with no stub needed; DELETE 404 on non-existent UUID.
- `seedTenantWithEmail` helper explicitly includes `contact_email` column to exercise migration 0006. UUID constants TENANT_ID `000000000001` / RES_ID `000000000099` safe in isolated Miniflare D1 per spec file.
**Why:** Tests define the implementation contract and prevent regressions. Integration tests asserted only on HTTP response codes — not on Resend call count — until implementation lands and can be extended.

### 2026-06-07: CORS lockdown — replace wildcard with explicit allowlist
**By:** Sean (Backend Developer)
**Source:** `.squad/decisions/inbox/sean-cors-lockdown.md`

Replaced the open wildcard `cors()` call in `src/app.ts` with an explicit configuration: `origin: ['https://maximum-bookings.pages.dev']`, `allowHeaders: ['Content-Type', 'Authorization']`, `allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']`, `exposeHeaders: ['Content-Length']`, `maxAge: 600`, `credentials: true`. This is Phase A of the origin whitelisting plan.

⚠️ **Caveat:** The deployed domain may be `maximum-bookings.<account>.workers.dev` rather than `maximum-bookings.pages.dev`. James should confirm the actual production URL and update the `origin` array if it differs. When running `wrangler dev`, widget requests are same-origin and CORS headers are not evaluated — no local dev impact.

### 2026-06-07: CORS origins — localhost + production
**By:** Sean (Backend Developer)
**Source:** `.squad/decisions/inbox/sean-cors-localhost.md`

Expanded the `origin` array in `src/app.ts` to include the confirmed production domain (`https://maximum-bookings.jameshealydesign.workers.dev`) and three localhost origins (`http://localhost:8787`, `http://localhost:3000`, `http://localhost:5173`). Localhost entries only matter when a separate frontend dev server runs cross-origin against the Worker — a common local dev scenario. Localhost origins are not a security risk and are added unconditionally rather than via environment detection (no `ENVIRONMENT` binding existed at the time of this decision).

### 2026-06-07: CORS origins are environment-conditional
**By:** James Healy
**Source:** `.squad/decisions/inbox/sean-cors-env-conditional.md`

Localhost origins (8787, 3000, 5173) are only included when `ENVIRONMENT=development`. Production serves only `maximum-bookings.jameshealydesign.workers.dev`. Prevents theoretical localhost-origin abuse in production; establishes a clean security boundary. **How to activate dev mode:** Set `ENVIRONMENT=development` in `wrangler.jsonc` `[vars]`. Set `ENVIRONMENT=production` in the Cloudflare dashboard for the production Worker.

### 2026-06-01: `contact_email` is required (NOT NULL) on Tenants
**By:** Sean (Backend Developer)
**Source:** `.squad/decisions/inbox/sean-contact-email-required.md`

`contact_email` on the `Tenants` table is now `NOT NULL`. Migration `migrations/0006_tenants_contact_email.sql` updates the column definition to `NOT NULL DEFAULT ''` (empty-string default is migration-time fallback only). `src/db/schema.ts` changes `TenantSchema.contact_email` from `z.string().email().nullable().optional()` to `z.string().email()`. All three `if (!tenant.contact_email)` null-guards removed from `src/routes/reservations.ts` POST, PATCH, DELETE `waitUntil` blocks. Type annotation updated to `string`. Email notifications are a core feature — enforcing NOT NULL at the DB layer keeps the email path clean and eliminates a silent failure mode.

### 2026-06-12: Booking management links resolve at `/booking`
**By:** Han (Lead)
**Source:** `.squad/decisions/inbox/han-booking-tenant-missing-param.md`
**What:** Customer confirmation/amendment emails must link to `/booking?id=...&email=...`, not `/booking/manage?...`. `/booking` is the real manage-booking entrypoint; `/booking/manage` falls through SPA fallback to the booking widget and triggers the `useTenant` missing-tenant error.
**Why:** `useManageBooking` already derives `tenant_id` from the reservation response. Fixing the path is sufficient; no `?tenant=` parameter or reservation API contract change is needed.

### 2026-06-12: Dual-port local dev remains the recommended setup
**By:** Han (Lead)
**Source:** `.squad/decisions/inbox/han-dual-port-dev-setup.md`
**Status:** Recommendation
**What:** Keep `npm run dev` as two processes: `wrangler dev` on `8787` and Vite on `5173`, with Vite proxying `/api` to the Worker. Treat `http://localhost:5173` as the canonical local app URL. Only follow-up cleanups recommended: rename/remove the misleading `start` script and optionally drop redundant `http://localhost:8787` from the dev CORS whitelist.
**Why:** The Workers runtime and Vite HMR solve different problems. Forcing a single-port setup would either lose HMR or add unnecessary complexity.

### 2026-06-12: Tenant CRUD is protected by super-admin auth
**By:** Sean (Backend Dev)
**Source:** `.squad/decisions/inbox/sean-c3-tenant-auth.md`
**What:** Protect `GET /api/tenants`, `POST /api/tenants`, `PATCH /api/tenants/:id`, and `DELETE /api/tenants/:id` with `superAdminAuth` backed by `X-Admin-Key` / `SUPER_ADMIN_KEY`. Keep `GET /api/tenants/:id` public for widget/bootstrap use, but return only a widget-safe projection.
**Why:** Tenant CRUD and internal contact data must not be publicly writable or exposed.

### 2026-06-12: Booking widget capacity model uses concurrent occupancy
**By:** Twinkie (Frontend Dev)
**Source:** `.squad/decisions/inbox/twinkie-concurrent-capacity.md`
**Status:** Applied
**What:** Remove `daily-capacity` fetching/state from the booking widget. Party-size options are derived from tenant config only: `max_guests` remains the per-booking cap, `max_covers` remains venue concurrent capacity, and the effective ceiling is the smallest positive limit across the two (fallback `20` when both are unset). Date-specific unavailability comes from blocked time slots, not a day-level remaining-covers warning.
**Why:** Aligns the widget with the backend's rolling occupancy model and removes the obsolete daily-total capacity concept.
**Notes:** Supersedes the 2026-05-30 daily-capacity UI decision.

### 2026-06-12: Reservation POST capacity tests use concurrent-window scenarios
**By:** Neela (QA)
**Source:** `.squad/decisions/inbox/neela-concurrent-capacity-tests.md`
**Status:** Implemented in tests
**What:** `test/index.spec.ts` validates reservation creation with rolling-window scenarios: separate windows remain valid, overlapping overflow is rejected, an exact time-limit boundary is accepted, and `max_covers = 0` bypasses the guard.
**Why:** `POST /api/reservations` now uses `calculateConcurrentGuests(...)` against overlapping occupancy, not same-day summed covers.

### 2026-06-12: Tenant CRUD auth coverage moved to a dedicated suite
**By:** Neela (QA)
**Source:** `.squad/decisions/inbox/neela-c3-tenant-tests.md`
**Status:** Implemented in tests
**What:** Keep C-3 tenant CRUD auth coverage in `test/tenants.spec.ts` and remove outdated unauthenticated tenant CRUD expectations from `test/index.spec.ts`. Protected routes must require `X-Admin-Key`; public tenant lookup remains read-only and projected.
**Why:** Matches the super-admin tenant contract without mixing unrelated concerns into the main reservation suite.


### 2026-06-19: Type centralization architecture
**By:** James Healy
**What:** Backend shared types live in `src/types/types.ts`. Rule: types used in 2+ files across different directories go there. Zod-inferred types stay co-located with their schemas in `src/db/schema.ts`. Frontend types stay in `src/frontend/shared/types/` and are accessed via the `@shared/types` alias. Component prop types and hook-local types stay in their own files.
**Why:** Eliminates scattered type definitions across utility files; creates a single lookup for shared backend types.

# Decision: API request optimisations — client-side cache, debounce, double-submit guards

**By:** Twinkie (Frontend Dev)
**Date:** 2026-07-02

## What

Implemented Items 1–5 from `documentation/api-request-optimisation.md`.

**Item 1+2+3 — Shared fetch util with cache and AbortController:**
Created `src/frontend/shared/utils/fetchBlockedDatesForMonth.ts` — a module-level singleton with a 5-minute `Map` cache keyed by `tenantId:YYYY-MM` and a shared `AbortController` that cancels any in-flight request when a new month is requested. Exported from `@shared/utils/index.ts`. The three previous copy-paste implementations in `useAvailability.ts`, `useManageBooking.ts`, and `CalendarPickerModal.tsx` all delegate to this util. Error string standardised to `'Could not load availability. Please try again.'` across all three callers.

**Item 1 (continued) — `fetchBlockedTimes` result cache in `useAvailability`:**
Added module-level `timesCache` (60-second TTL) keyed by `bt:tenantId:date:guests`. Cache hit returns immediately without creating a new `AbortController`, so back-navigation to a previously-seen (date, guests) combination is instant.

**Item 1 (continued) — `bustBlockedDatesCache` re-export:**
`useAvailability.ts` re-exports `bustMonth as bustBlockedDatesCache` at module level. `BookingApp.handleNewBooking` calls this before re-fetching, ensuring the calendar reflects the just-completed booking.

**Item 2 (continued) — `CalendarPickerModal` open-effect bug fix:**
The `useEffect([open])` reset calendar state but never fetched blocked dates, so the admin date picker showed no blocked days until month navigation. Fixed by adding `void fetchBlockedDates(...)` at the end of the `if (open)` block.

**Item 4 — 250ms debounce on guest-count changes:**
`BookingApp.handleGuestsChange` now uses a plain `setTimeout`/`clearTimeout` debounce. A user stepping 2→8 guests fires one fetch instead of six.

**Item 5 — Double-submit guards in `useManageBooking`:**
Added `isSaving` and `isCancelling` signals to the hook. `saveEditDetails` and `saveDatetime` guard on `isSaving`; `confirmCancel` guards on `isCancelling`. All three use `finally` blocks to reset the flags. Both signals exported from the hook return.

## Why

`/api/reservations/blocked-dates` was fetched unconditionally on every month navigation across three separate implementations, with no abort protection against stale responses and no deduplication. Users on slow connections could see incorrect blocked-day indicators due to out-of-order responses. The shared util eliminates the duplication and fixes the race in one place. The guest debounce and mutation guards are low-effort follow-ons that protect the Worker from unnecessary load.

## Notes

- `EditDetails`, `ChangeDateTime`, and `CancelConfirm` components already maintain their own local `isSaving`/`isCancelling` signals for UI loading state; the new hook-level guards are defence-in-depth at the API layer. No component threading was required.
- The module-level `AbortController` in the shared util is intentional: only one calendar is active at a time, so aborting a previous fetch when a new month is requested is always correct.
- `CalendarPickerModal` error string updated from `'Could not load availability.'` to `'Could not load availability. Please try again.'` to match the other callers.

### 2026-07-02: Added Cache-Control headers
**By:** Sean
**What:** Added Cache-Control headers to GET /api/reservations/blocked-dates (public, max-age=300), GET /api/reservations/blocked-times (private, max-age=60), and GET /api/tenants/:id (public, max-age=3600).
**Why:** Approved in documentation/api-request-optimisation.md — reduces redundant D1 queries and Worker invocations.

### 2026-07-02: Test coverage for API request optimisations
**By:** Neela
**What:** Written tests for fetchBlockedDatesForMonth util (cache, abort, bust), useAvailability times cache, useManageBooking double-submit guards, and BookingApp debounce.
**Why:** Coverage for all changes in documentation/api-request-optimisation.md implementation.

## Directives

### 2026-05-23T07-31-02: User directive
**By:** James Healy (via Copilot)
**What:** All write-ups, planning docs, and analysis markdown files must be placed in `./documentation/` — not the repo root, not `.squad/temp/`.
**Why:** User request - captured for team memory

### 2026-05-23T07-35-35: User directive
**By:** James Healy (via Copilot)
**What:** Agents must NEVER run any of the following git commands: `git add`, `git commit`, `git push`, `git merge`. No exceptions. All git operations are James's responsibility.
**Why:** User request - captured for team memory


### 2026-06-12T22-24-56: User directive
**By:** James (via Copilot)
**What:** The squad must NEVER run git add, git commit, or git push. No member should prompt the user to run these commands either.
**Why:** User request - captured for team memory

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
