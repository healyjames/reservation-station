# Squad Decisions

## Active Decisions

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

### 2026-07-05T17:18:33+01:00: blocked-dates API shape change
**By:** Sean
**What:** GET /blocked-dates now returns { blocked_dates: string[], closed_dates: string[] } instead of a merged { blocked_dates: string[] }. Admin-blocked dates and venue-closed dates are kept separate so the frontend can show distinct tooltip messages.
**Why:** Feature requirement — different tooltip text for admin-blocked vs venue-closed dates.

### 2026-07-05T17:18:33+01:00: closedDates signal added to useAvailability and useManageBooking
**By:** Twinkie
**What:** Added closedDates Signal<Set<string>> to useAvailability and useManageBooking hooks. Calendar.tsx now accepts closedDates prop and switches tooltip message based on which set a blocked date belongs to.
**Why:** Frontend implementation of differentiated tooltip messages for admin-blocked vs venue-closed dates.

### 2026-07-05T17:18:33+01:00: blocked-dates test suite updated for split response shape
**By:** Neela
**What:** Updated two test files to match the new `GET /api/reservations/blocked-dates` response shape (`blocked_dates` + `closed_dates`) and the new `fetchBlockedDatesForMonth` return type (`adminBlocked` + `closed` instead of `dates`).

**Changes — `fetchBlockedDatesForMonth.test.ts`:**
- All `result.dates` references replaced with `result.adminBlocked` (or `result.closed` where appropriate)
- All mock responses updated to include `closed_dates: []` alongside `blocked_dates`
- Error path tests now assert `result.adminBlocked.size === 0` and `result.closed.size === 0`
- Test description updated: "returns dates" → "returns adminBlocked dates"; error descriptions updated similarly
- Three new tests added:
  - `'populates only adminBlocked when API returns blocked_dates with no closed_dates'`
  - `'populates only closed when API returns closed_dates with no blocked_dates'`
  - `'populates both adminBlocked and closed independently when API returns both arrays'`
- New tests use unique tenant IDs: `tenant-admin-only-1`, `tenant-closed-only-1`, `tenant-both-1`

**Changes — `useAvailability.test.ts`:**
- `fetchBlockedDates` describe block: all mock responses updated to include `closed_dates: []`
- One new test added: `'populates closedDates signal when API returns closed_dates'` (tenant `tenant-bd-closed-1`)
- `fetchBlockedTimes` describe block: untouched (unaffected by the shape change)
- All existing assertions preserved — they test the right things, the mock shape was the only gap

**Why:** Tests must describe the contract that the code is held to. Stale assertions against the old shape would pass on the old code and fail to catch regressions against the new shape (or vice versa). Every test name is documentation of the expected behaviour.

# Han Decision — Tenant Onboarding

Recommendation: implement Option B now — a protected `POST /api/admin/tenants` onboarding endpoint gated by `SUPER_ADMIN_KEY`, creating `Tenant` + first `AdminUser` atomically with D1 `db.batch()` and prepared statements.

Do not build a super-user dashboard for the first-client go-live. Do not keep `scripts/seed-admin.ts` as a production SQL writer. If a script remains, it should only prompt locally and call the protected endpoint.

Rationale: the real requirement is safe owner-operated onboarding for one client, not self-service tenant management. The current script is risky because it documents production-looking IDs in a public repo, takes secrets via shell env, interpolates SQL into `wrangler d1 execute`, defaults to `--remote`, duplicates password hashing, and leaves tenant/admin creation non-atomic.

Upgrade path: the endpoint/service function becomes the future backend for a super-admin dashboard when the second/third client creates real operational pressure.

Implementation owners:
- Sean: endpoint/schema/service, D1 batch transaction, password hashing reuse, script deletion/replacement, secret handling docs.
- Neela: endpoint tests, rollback/duplicate cases, login verification.
- Twinkie: no UI in this phase.

### 2026-07-07T14:02:27Z: tenant onboarding route-location decision
**By:** Coordinator synthesis
**What:** Extend the existing super-admin-gated `POST /api/tenants` route for safe tenant onboarding rather than adding a new `/api/admin/tenants` path. The implementation should create the tenant and first admin user atomically via D1 `db.batch()` and reuse password hashing instead of keeping `scripts/seed-admin.ts` as a production SQL writer.
**Why:** `/api/admin/*` is the tenant-scoped JWT namespace. Tenant onboarding is a platform-level operation already aligned with `superAdminAuth`, `SUPER_ADMIN_KEY`, and existing `POST /api/tenants` prior art.

### 2026-07-07T15:07:01Z: Sean decision note — tenant onboarding implementation
**Source:** `.squad/decisions/inbox/sean-onboarding-impl.md`

# Sean decision note — tenant onboarding implementation

## Final contract

`POST /api/tenants` remains the platform-level super-admin route gated by `X-Admin-Key` / `SUPER_ADMIN_KEY`.

Request body:

```json
{
  "tenant": {
    "name": "Example Restaurant",
    "tenant_code": "example-restaurant",
    "max_guests": 8,
    "max_covers": 40,
    "status": "active",
    "concurrent_guests_time_limit": 120,
    "contact_email": "owner@example.com"
  },
  "admin": {
    "email": "admin@example.com",
    "password": "at-least-12-chars"
  },
  "opening_hours": [
    { "day_of_week": 0, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 1, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 2, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 3, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 4, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 5, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 6, "is_closed": 1, "open_time": null, "close_time": null }
  ]
}
```

`opening_hours` is optional; omitted rows default to seven closed days.

Success response:

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "generated-uuid",
      "tenant_code": "example-restaurant",
      "name": "Example Restaurant"
    },
    "admin": {
      "email": "admin@example.com"
    }
  }
}
```

## Behaviour change

`POST /api/tenants` no longer performs tenant-only creation. It now creates the tenant, first `AdminUsers` row, and seven `OpeningHours` rows atomically with D1 `db.batch()`.

## Script removal

`scripts/seed-admin.ts` was removed. Operators should use `documentation/tenant-onboarding-runbook.md` and call the protected endpoint instead of writing production SQL from a local script.

### 2026-07-07T15:07:01Z: Neela onboarding tests verdict
**Source:** `.squad/decisions/inbox/neela-onboarding-tests.md`

# Neela onboarding tests verdict

APPROVED

Coverage added in `test/tenants.spec.ts` for the repurposed `POST /api/tenants` onboarding contract: nested tenant/admin request shape, 401s, 201 response envelope, password-hash omission, D1 persistence for tenant/admin/opening-hours, default seven closed days, custom seven-day opening hours, admin login, duplicate tenant_code rollback, duplicate admin email rollback, and invalid tenant/admin validation with no created rows.

Validation: `npx vitest run test\tenants.spec.ts --reporter=dot` passes with 30 tests passing in 1 file.

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
