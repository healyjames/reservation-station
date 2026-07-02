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
