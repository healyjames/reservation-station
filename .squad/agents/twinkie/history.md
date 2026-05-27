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
