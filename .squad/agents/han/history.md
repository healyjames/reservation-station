# Han - History

## Core Context

Lead on the Maximum Bookings project. Restaurant booking system built on Cloudflare Workers + Pages, D1, Hono, vanilla JS widget.

**User:** James Healy
**Team:** Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe

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
- **2026-05-27 — Surface boundary after shared-first migration:** `src/frontend/booking-widget/`, `admin/`, `cancel/`, and `booking/manage/` should stay as thin surface entries. They are standalone HTML/bundle boundaries, not shared components. The real remaining architecture issue is mixed ownership between legacy `public/` surfaces and new Preact surfaces, plus the ambiguous root entry (`public/index.html` still builds as `/` while `src/frontend/index.html` suggests a Preact root). Worker/API vs frontend separation is sound, but route response envelopes are still inconsistent with the preferred `{ success, data?, error? }` contract.
- **2026-06-01 — Email notifications architecture:** For reservation emails, keep `sendEmail()` transport-only (`env + { to, from, subject, html }`) and keep template selection/data shaping in route code. Use one joined reservation+tenant lookup for notification context. DELETE must fetch before delete; PATCH must fetch before update and re-fetch after update. `Tenants.contact_email` should be nullable in D1 and modeled as `z.email().nullable().optional()` in schema so tenant create/update stays backward-compatible.

### Dual-port dev setup investigation (2026-06-12)

- The two-port setup (8787 + 5173) is **intentional**, not a misconfiguration. The `dev` script explicitly uses `concurrently` to run both `wrangler dev` (Hono API at 8787) and `vite` (Preact frontend at 5173 with `/api` proxy).
- This is the correct local dev pattern for Workers-with-Assets when using Vite for the frontend. `wrangler dev` cannot provide Vite HMR — they are separate runtimes.
- `localhost:5173` is the canonical dev URL. `localhost:8787` is a backend implementation detail. `PUBLIC_URL = "http://localhost:5173"` in `wrangler.jsonc` confirms this intent.
- The `start` script (`wrangler dev` alone) is potentially confusing — it starts only the API, not the full stack. `dev` is the correct script for full-stack development.
- Alternative: `wrangler dev` alone + `vite build --watch` gives single-port (8787) development but at the cost of HMR. Not worth it for an actively developed Preact frontend.
- The CORS whitelist in `src/app.ts` pushes both `localhost:8787` and `localhost:5173` in dev. `localhost:8787` is redundant for browser requests (same-origin to wrangler dev), but harmless.

### Booking management page URL bug (2026-06-12)

- The `/booking` page (`booking-manage.tsx` → `BookingManageApp` → `useManageBooking`) does NOT call `useTenant`. It is self-contained: fetches reservation by `?id=` + `?email=`, then fetches tenant from `res.tenant_id`. No `?tenant=` param needed.
- `useTenant` is only used by the booking widget (`booking-widget/BookingApp.tsx`). It is not in the manage-booking flow at all.
- The "Unable to load booking configuration" error appears because `customer-confirmation.ts` and `customer-amendment.ts` generate email links to `/booking/manage?id=...` — a path that does not exist. The SPA fallback in both Vite dev and wrangler (`not_found_handling: "single-page-application"`) serves `dist/index.html` (the booking widget) for any unmatched path, including `/booking/manage`. The booking widget calls `useTenant`, which fails without `?tenant=`.
- Fix: change `/booking/manage?id=...` to `/booking?id=...` in both email templates. Two lines. Nothing else needs to change.
- Secondary find: `BookingManageApp.tsx` `case 'error'` hardcodes `message={"AHHH"}` instead of `message={hook.errorMessage.value}`. Should be fixed alongside.

### AdminSidebar review (2026-05-21)

- Reviewed Twinkie's AdminSidebar extraction. **APPROVED** with one non-blocking accessibility note.
- All six criteria passed: correctness, code quality, CSS, accessibility, integration, no regressions.
- `aria-expanded`, `aria-controls`, `aria-label`, `aria-hidden`, `aria-current="page"` all correct. Z-index stack (overlay 40, sidebar 50, hamburger 60) confirmed. Dashboard.module.css and Settings.module.css confirmed clean.
- Non-blocking follow-up: hamburger `aria-label="Open navigation"` is static. Dynamic label is best practice: `aria-label={isOpen.value ? 'Close navigation' : 'Open navigation'}`. `aria-expanded` is sufficient for screen readers — not a blocker.

### Blocked-times API optimisation analysis (2026-07-02)

- The current debounce + abort + cache pattern is already acceptable for normal widget traffic; the real waste is narrower.
- For unlimited-capacity tenants (`max_covers = 0`), blocked-times responses are guest-agnostic, so guest-specific cache keys and guest-specific URLs are unnecessary duplication.
- The recommended first step is a shared blocked-times fetch/cache utility plus a date-level cache key for unlimited-capacity venues.
- A broader availability-matrix redesign is valid only if guest-change latency or request volume becomes a measured problem; if pursued, keep occupancy math server-side and expose `availableCapacity`, not raw occupancy.

### Tenant onboarding recommendation (2026-07-07)

- Recommended protected backend onboarding over a first-client super-user dashboard.
- Coordinator route-location decision: extend existing super-admin-gated `POST /api/tenants`; do not add `/api/admin/tenants` because `/api/admin/*` remains tenant-scoped JWT admin space.
- Onboarding implementation should atomically create tenant + first admin with D1 `db.batch()` and retire production use of `scripts/seed-admin.ts` as a direct SQL writer.

### Date-specific opening hours analysis (2026-07-08)

- Key files: `src/routes/availability.ts` (blocked-times/blocked-dates resolution), `src/routes/reservations.ts` (POST creation guards), `src/schema/index.ts` (BlockedDateSchema, UpsertOpeningHoursSchema), `db/schema.sql`, `migrations/0005_opening_hours.sql`.
- **Critical finding:** There is NO recurrence concept in `BlockedDates`. "Closed every Monday" = a single `OpeningHours(day_of_week=1, is_closed=1)` row. There are no per-date rows for recurring closures. Unblocking one Monday must be additive — a new override row — and must never touch `OpeningHours`.
- **Chosen approach:** New `DateOverrides` table keyed `UNIQUE(tenant_id, date)` with `is_closed, open_time, close_time, reason`. A single COALESCE LEFT JOIN query resolves `DateOverrides` → `OpeningHours(DOW)` → default. One unifying concept handles special hours, full-closure overrides, and DOW unblocks.
- **Precedence rule:** `BlockedDates(full-day admin)` > `DateOverrides` > `OpeningHours(DOW)` > default.
- **SQL pattern:** `LEFT JOIN DateOverrides do ON do.tenant_id=? AND do.date=? LEFT JOIN OpeningHours oh ON oh.tenant_id=? AND oh.day_of_week=?` with `COALESCE(do.is_closed, oh.is_closed, 0)` etc.
- **blocked-dates month loop** (in `availability.ts`): needs one extra D1 query per call to fetch `DateOverrides` for the month; JS loop applies override map before falling back to DOW set.
- **Migration:** `migrations/0011_date_overrides.sql`.
- **Plan:** `documentation/date-specific-opening-hours-plan.md`.
