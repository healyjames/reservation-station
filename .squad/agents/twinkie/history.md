# Twinkie - History

## Core Context

Frontend Dev on the Maximum Bookings project. Twinkie owns frontend surface work, shared Preact UI implementation, and the public/admin stylesheet boundary.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph

### Stable Conventions

- No inline code comments unless genuinely necessary.
- Write-ups, planning docs, and analysis markdown belong in `./documentation/`.
- `theme.js` remains a blocking script in HTML `<head>` so theme state applies before first paint.
- Frontend surfaces stay as thin entries under `src/frontend/`; reusable runtime code lives under `src/frontend/shared/`.
- `public/shared.css` is the shared base layer; `public/styles.css` and `public/admin/styles/admin.css` are surface layers on top of it.
- Shared components still depend on a few intentional global hooks from `public/shared.css` such as `.details-list` and `.detail-row`.

### Condensed Work History

- **Asset split / vanilla widget baseline (2026-04-01):** `public/index.html` was split into `public/styles.css`, blocking `public/js/theme.js`, and module `public/js/calendar.js`. Calendar starts on Monday, uses a burgundy palette, marks today with a dot, and fully re-renders on each call.
- **Booking flows (2026-04-01 to 2026-05-21):** The multi-step booking form, blocked-times handling, cancel page, manage-booking page, and settings hash-routing all use explicit view/state transitions, fail-open fetch handling where appropriate, and UTC-safe date formatting (`T12:00:00Z`) to avoid timezone drift.
- **Admin foundation (2026-04-05 to 2026-05-18):** Admin login/dashboard/settings shipped first in vanilla form, then gained spacing tokens, the two-panel layout, date picker extraction, Blocked Dates UI, and Opening Hours management.
- **Preact migration (2026-05-22 to 2026-05-24):** Vite + `tsconfig.frontend.json` established the multi-entry frontend build; shared utilities and component layers landed under `src/frontend/shared/`; the cancel, booking widget, manage-booking, and admin surfaces were migrated to Preact with zero TypeScript errors.
- **CalendarGrid extension (2026-05-24):** Range-selection props (`isRangeStart`, `isInRange`, `isRangeEnd`, `onHoverDate`, `onLeaveGrid`) were added to `CalendarGrid`/`DayCell` with safe defaults so non-admin consumers stay unaffected.

## Recent Learnings

### Frontend structure + canonical entrypoints (2026-05-27)

- Surface folders remain entry-only: `booking-widget/`, `admin/`, `cancel/`, and `booking/manage/` keep HTML/bootstrap/app files, while shared hooks, types, components, and the admin fetch helper live under `src/frontend/shared/`.
- `src/frontend/index.html` is the canonical built root entry; legacy public surface files that already had Preact replacements were retired.
- `public/styles.css`, `public/shared.css`, `public/admin/styles/admin.css`, fonts, and `public/js/theme.js` remain live runtime dependencies for the Preact HTML entries.

### CSS audit + cleanup boundary (2026-05-27 to 2026-05-28)

- The audit token layer was first introduced as `public/frontend-audit.css`, then folded into the existing surface stylesheets (`public/styles.css`, `public/shared.css`, `public/admin/styles/admin.css`) so extra audit `<link>` tags could be removed without changing cascade order.
- Admin HTML must not link `/shared.css` directly when `public/admin/styles/admin.css` already imports it; otherwise the shared base loads twice.
- `public/shared.css` should stay focused on tokens, resets, shared primitives, standalone-page helpers, and the few intentional global hooks used by shared components. Surface presentation belongs in `public/styles.css` or `public/admin/styles/admin.css`.
- Form element CSS modules must explicitly set `font-family: inherit`; otherwise buttons, inputs, and selects fall back to browser defaults after the Preact migration.

## Learnings

### BookingManage Overview CSS module extraction (2026-05-27)

- `Overview.tsx` referenced one global class: `action-group`.
- `action-group` is shared by `CancelConfirm.tsx`, `ChangeDateTime.tsx`, and `EditDetails.tsx`, so its global rules stay in `public/shared.css`.
- Copied the equivalent rules into `Overview.module.css`, including the `@media (min-width: 640px)` grid-column layout.
- Mapping used: `action-group` → `action_group`.

### BookingManage ChangeDateTime CSS module extraction (2026-05-27)

- `ChangeDateTime.tsx` referenced `calendar-container`, `calendar-header`, `calendar-nav`, `calendar-nav-btn`, `loading-indicator`, `compact-loading`, `inline-helper`, `inline-helper-error`, `action-group`, and `mt-2`.
- `action-group` is still shared with `CancelConfirm.tsx` and `EditDetails.tsx`, so its global rules stay in `public/shared.css`; `calendar-*`, `loading-indicator`, `compact-loading`, and `inline-helper*` were only found in `ChangeDateTime.tsx` and are now candidates for later global cleanup.
- Mapping used: `calendar-container` → `container`, `calendar-header` → `header`, `calendar-nav` → `nav`, `calendar-nav-btn` → `nav_btn`, `loading-indicator` → `loading_indicator`, `compact-loading` → `compact_loading`, `inline-helper` → `inline_helper`, `inline-helper-error` → `inline_helper_error`, `action-group` → `action_group`.
- No CSS rule exists for `mt-2` in `public/shared.css` or `public/styles.css`, so the literal class was left in place while the extracted styles moved to the module.

### BookingManage EditDetails CSS module extraction (2026-05-27)

- `EditDetails.tsx` referenced `action-group` and `mt-2`.
- `action-group` is still shared with `CancelConfirm.tsx` and `ChangeDateTime.tsx`, so its global rules stay in `public/shared.css`; no global CSS rule exists for `mt-2`, so that literal class remains in the markup.
- Mapping used: `action-group` → `action_group`.

### BookingManage SuccessCancel CSS module extraction (2026-05-27)

- `SuccessCancel.tsx` referenced no literal `class=` or `className=` selectors, so the success screen was scoped with a local wrapper based on the existing `booking-form-content` rule from `public/styles.css`.
- `booking-form-content` is still shared with `src/frontend/booking-widget/BookingApp.tsx`, so its global rule stays in place and no new orphaned globals were introduced.
- Mapping used: `booking-form-content` → `content`.

### BookingManage CancelConfirm CSS module extraction (2026-05-27)

- `CancelConfirm.tsx` referenced one global class: `action-group`.
- `action-group` rules were found in `public/shared.css` (base grid + `@media (min-width: 640px)` two-column layout) and not in `public/styles.css`.
- `action-group` had no remaining TSX consumers under `src/` beyond `CancelConfirm.tsx`, so the global rule now appears newly orphaned; it stays in `public/shared.css` for James's later cleanup pass.
- Mapping used: `action-group` → `action_group`.

### BookingManage SuccessEdit CSS module extraction (2026-05-27)

- `SuccessEdit.tsx` had no literal `class` or `className` references to extract, so the success screen was scoped with a new local wrapper based on the existing `booking-form-content` rule from `public/styles.css`.
- `booking-form-content` is still shared with `src/frontend/booking-widget/BookingApp.tsx`, so the global rule stays in place and no new orphaned globals were introduced.
- Mapping used: `booking-form-content` → `content`.

### BookingManage Loading CSS module extraction (2026-05-27)

- `Loading.tsx` now uses module classes equivalent to the old `loading-indicator compact-loading` wrapper for the spinner row and loading copy.
- `loading-indicator` and `compact-loading` were found in `public/shared.css` and not in `public/styles.css`; grepping `src/**/*.tsx` showed no remaining TSX consumers outside the migrated module, so both globals now appear orphaned.
- Mapping used: `loading-indicator` → `loading_indicator`, `compact-loading` → `compact_loading`.

### Admin component CSS module extraction (2026-05-29)

- Created 13 CSS module files covering all Admin components + AdminApp entry: `AdminApp.module.css` (in `src/frontend/admin/`), and `Login`, `Dashboard`, `Settings`, `DateNav`, `BookingCard`, `BookingCards`, `BookingModal`, `ReservationList`, `SettingsPanel`, `GeneralSettings`, `OpeningHoursSettings`, `BlockedDatesSettings` modules in `src/frontend/shared/components/Admin/`.
- Settings.tsx shares the same layout class names as Dashboard.tsx (dashboard-layout, sidebar-nav, etc.) — each got its own module file rather than cross-importing.
- `modal-actions` in `BookingModal.tsx` was intentionally left as a global string class; the `Modal` component owns footer layout styling.
- Responsive show/hide logic (`admin-table` hidden on mobile, `booking-cards`/`oh-cards` hidden on desktop) was baked into each component's module file using `@media` queries.
- camelCase mapping for BEM modifiers: `tab-btn--sub` → `tabBtnSub`, `date-picker-popup--inline` → `datePickerPopupInline`, `bd-legend-swatch--blocked` → `bdLegendSwatchBlocked`.
- Multi-class combos use template literals: `` class={`${styles.adminTable} ${styles.bookingTable}`} ``.
- Conditional active states use: `` class={`${styles.tabBtn}${isActive ? ` ${styles.active}` : ''}`} ``.
- OpeningHoursSettings banner used a dynamic `alert-${type}` pattern; converted to ternary: `` `${styles.alert} ${styles.ohBanner} ${type === 'success' ? styles.alertSuccess : styles.alertError}` ``.
- `form-group` is defined globally in `public/shared.css` but was redefined locally in Login and GeneralSettings modules so those components are fully self-contained with scoped styles.


- `Error.tsx` had no literal `class` or `className` references to extract, so the error screen was scoped with a new local wrapper based on the existing `booking-form-content` rule from `public/styles.css`.
- `booking-form-content` is still shared with `src/frontend/booking-widget/BookingApp.tsx`, so the global rule stays in place; `error-container` appears globally orphaned because it has no TSX consumers under `src/`.
- Mapping used: `booking-form-content` → `content`.

### Admin CSS module naming compliance fix (2026-05-30)

- All 12 Admin CSS module files and their paired TSX files were corrected to comply with the css-module-extraction skill.
- The underscore naming rule is absolute: **every multi-word CSS module class name must use underscores, never camelCase**. loginLayout ❌ → login_layout ✅.
- The previous extraction work had used camelCase (e.g. 	abBtn, mainPanel, 	oggleListItem) — these were all converted to underscore form across both .module.css files and styles.xxx references in the TSX.
- dateNav in DateNav.module.css was also renamed to date_nav — even single-apparent-word names that contain hidden camelCase boundaries must follow the rule.
- AdminApp.module.css loadingScreen → loading_screen was corrected in both the module and AdminApp.tsx.

### Admin shared input adoption (2026-05-28)

- `Login.tsx` and `GeneralSettings.tsx` now follow the same `FormField` + `Input` pattern already used in `Admin/BookingModal.tsx`.
- Local `.form_group` input styling was removed from `Login.module.css` and `GeneralSettings.module.css` because the shared `Input` component now owns those states and visuals.
- `Input.tsx` gained a `min` prop so numeric admin settings can keep their existing minimum constraints while using the shared field primitive.
- `OpeningHoursSettings.tsx` was intentionally left on raw time inputs because its controls require `step={1800}` and the shared `Input` component still does not support `step`.
