# API Request Optimisation

## Overview

The app makes reasonable API calls overall, but three issues stand out: **`/api/reservations/blocked-dates` is fetched with no cache and no race protection, and the fetch logic is copy-pasted across three separate files**. These together mean a user navigating the calendar can fire many redundant network requests, and in the worst case receive stale data due to out-of-order responses. A module-level `Map` cache with a short TTL eliminates the majority of repeat requests at near-zero cost. Secondary wins include a debounce on guest-count changes, double-submit guards on mutation handlers, and HTTP `Cache-Control` headers to let Cloudflare and browsers cache clean reads. D1 indexes on the hot query paths are already in place — no new migrations needed.

---

## Current Request Inventory

| # | Endpoint | Method | Triggered by | Frequency | AbortController | Result cache |
|---|----------|--------|--------------|-----------|-----------------|--------------|
| 1 | `/api/tenants/:tenantId` | GET | `useTenant` on widget mount; `useManageBooking.init` after reservation load | Once per page | ❌ (not needed) | ❌ |
| 2 | `/api/reservations/blocked-dates` | GET | `useAvailability.fetchBlockedDates` (calendar month nav, post-booking refresh); `useManageBooking.fetchBlockedDatesForMonth` (enter date-change view + month nav); `CalendarPickerModal.fetchBlockedDates` (admin month nav) | Every month navigation — unbounded | ❌ | ❌ |
| 3 | `/api/reservations/blocked-times` | GET | `useAvailability.fetchBlockedTimes` (date select, every guest-count step); `useManageBooking.fetchBlockedTimesForDate` (enter date-change view, date pick) | Every date pick + every guest-count increment | ✅ (both callers) | ❌ |
| 4 | `/api/reservations` | POST | `useBookingForm.submitBooking` | Once per form submit | N/A | N/A |
| 5 | `/api/reservations/:id` | GET | `useManageBooking.init`; `useCancelBooking.loadReservation` | Once per page | ❌ (not needed) | ❌ |
| 6 | `/api/reservations/:id` | PATCH | `useManageBooking.saveEditDetails`; `useManageBooking.saveDatetime` | Once per user save — no guard | ❌ | N/A |
| 7 | `/api/reservations/:id` | DELETE | `useManageBooking.confirmCancel`; `useCancelBooking.handleCancel` | Once per confirm — `confirmCancel` unguarded | ❌ (`confirmCancel`) / ✅ (`handleCancel`) | N/A |
| 8 | `/api/auth/login` | POST | `useAuth.login` | Once per login | ❌ (not needed) | N/A |
| 9 | `/api/admin/reservations?date=` | GET | `useBookings.fetchBookings` (mount, prev/next day) | Every day navigation | ❌ | ❌ |
| 10 | `/api/admin/blocked-dates?date=` | GET | `useBookings.fetchBlockState` — called after every `fetchBookings` | Every day navigation (paired with #9) | ❌ | ❌ |
| 11 | `/api/admin/blocked-dates` | POST | `useBookings.toggleDayBlock` (block day) | Once per toggle, guarded | ✅ (`isBlockLoading`) | N/A |
| 12 | `/api/admin/blocked-dates/date/:date` | DELETE | `useBookings.toggleDayBlock` (unblock day) | Once per toggle, guarded | ✅ (`isBlockLoading`) | N/A |
| 13 | `/api/admin/reservations/:id` | DELETE | `useBookings.deleteBooking` | Once per deletion | ❌ (not needed) | N/A |

---

## Problems Identified

**1. [High] `fetchBlockedDates` has no result cache anywhere.**
Three separate implementations — `useAvailability.fetchBlockedDates` (line 25 of `useAvailability.ts`), `useManageBooking.fetchBlockedDatesForMonth` (line 136 of `useManageBooking.ts`), and `CalendarPickerModal.fetchBlockedDates` (line 46 of `CalendarPickerModal.tsx`) — all fire unconditionally on every month navigation. A user paging through 6 months fires 6 requests. None of the results are stored. Navigating back to a previously-viewed month re-fetches identically. The data changes infrequently; a 5-minute in-memory cache would serve the vast majority of month navigations from cache at zero cost.

**2. [High] `fetchBlockedDates` has no AbortController in any of its three implementations.**
`useAvailability.fetchBlockedDates`, `useManageBooking.fetchBlockedDatesForMonth`, and `CalendarPickerModal.fetchBlockedDates` all lack an `AbortController`. Rapid prev/next month navigation queues multiple concurrent requests. Because D1 responses arrive in non-deterministic order, an older month's response can land after the newer month's response and overwrite `blockedDates.value` with stale data. The user sees incorrect blocked-day indicators with no visible error. `fetchBlockedTimes` already applies the correct abort pattern — `fetchBlockedDates` needs the same treatment.

**3. [High] `fetchBlockedDates` logic is copy-pasted in three locations.**
`useAvailability.ts` lines 25–41, `useManageBooking.ts` lines 136–153, and `CalendarPickerModal.tsx` lines 46–63 are near-identical implementations. Any fix (caching, abort, error handling) must be applied three times, and the track record shows they're already drifting: `CalendarPickerModal` uses the error string `'Could not load availability.'` while the other two use `'Could not load availability. Please try again.'`. There is also a minor UX bug in `CalendarPickerModal` — its `useEffect` (line 34) resets calendar state on open but does not call `fetchBlockedDates`, so the admin calendar picker shows no blocked dates until the user navigates to a different month.

**4. [Medium] `fetchBlockedTimes` is called on every guest-count increment with no debounce.**
`BookingApp.handleGuestsChange` (line 57 of `BookingApp.tsx`) calls `fetchBlockedTimes` synchronously on every step of the guest spinner. A user changing from 2 → 8 guests fires 6 sequential abort-and-refetch cycles. The `AbortController` prevents requests from piling up, but still sends 6 round trips to the Worker, each of which executes 4 D1 queries. A 250 ms debounce on `handleGuestsChange` collapses this to 1 request per settled value with no perceptible UX change.

**5. [Medium] `saveEditDetails`, `saveDatetime`, and `confirmCancel` in `useManageBooking` have no double-submit guard.**
`saveEditDetails` (line 203) and `saveDatetime` (line 227) both issue `PATCH /api/reservations/:id`. `confirmCancel` (line 256) issues `DELETE /api/reservations/:id`. None of these functions check an `isSaving` or `isCancelling` flag before proceeding. A user who double-taps the save or cancel button sends two mutations. `useBookingForm.submitBooking` already uses `isSubmitting.value` as a guard (line 53 of `useBookingForm.ts`) and `useCancelBooking.handleCancel` uses `isCancelling.value` — `useManageBooking` is the only hook that skips this pattern.

**6. [Medium] No HTTP `Cache-Control` headers on any read endpoint.**
`GET /api/reservations/blocked-dates`, `GET /api/reservations/blocked-times`, and `GET /api/tenants/:id` return no `Cache-Control` header (confirmed by reviewing `src/routes/reservations.ts` and `src/routes/tenants.ts`). Every response is treated as uncacheable by the browser and by Cloudflare's edge cache, so identical requests within seconds of each other still go to the Worker and re-query D1. Adding appropriate headers on these three endpoints is a one-line-per-route change with meaningful impact on request volume and perceived latency.

**7. [Low] `GET /api/reservations/blocked-dates` makes a redundant tenant existence check.**
The handler at line 55 of `reservations.ts` performs `SELECT id FROM Tenants WHERE id = ?` before fetching blocked dates. This is a round trip to D1 solely to validate that the tenant exists. Since `BlockedDates` has a foreign key referencing `Tenants`, a tenant that doesn't exist simply returns zero rows from the main query. The 404 validation is useful but could be deferred to the data query results, saving one D1 call per blocked-dates request.

**8. [Low] `fetchBlockedTimes` has no result cache — same (date, guests) pair refetches on back-navigation.**
Both `useAvailability.fetchBlockedTimes` and `useManageBooking.fetchBlockedTimesForDate` abort and refetch on every date pick or guest change, even if the same `(date, guests)` combination was already fetched earlier in the session. If a user picks date A → date B → date A again, the blocked times for A are fetched twice. Given that `blocked-times` is the most expensive endpoint (4 D1 queries + an O(slots × reservations) computation), a 60-second in-memory cache keyed by `(tenantId, date, guests)` avoids repeat work for recently-viewed combinations.

**9. [Low] Admin panel fires two sequential requests per day navigation, with no abort protection.**
`useBookings.fetchBookings` (line 43 of `useBookings.ts`) awaits `/api/admin/reservations?date=`, then immediately calls `fetchBlockState` (line 58) which awaits `/api/admin/blocked-dates?date=`. These are always issued together and always for the same date. Neither has an `AbortController`, so rapid `prevDay()`/`nextDay()` presses can queue multiple in-flight pairs. A per-date cache (keyed by date string) would make back-navigation instant. A combined endpoint (`/api/admin/day-summary?date=`) would halve the request count if the backend is ever extended.

---

## Proposed Optimisations

### 1. Client-side result cache in `useAvailability`

Move `fetchBlockedDates` and `fetchBlockedTimes` to use module-level `Map` caches. Module-level is correct here: there is exactly one `useAvailability` instance per page, and module scope persists for the lifetime of the page without any global variable pollution.

**Add to the top of `src/frontend/shared/hooks/useAvailability.ts`** (outside the hook function):

```ts
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const datesCache = new Map<string, CacheEntry<Set<string>>>();
const timesCache = new Map<string, CacheEntry<string[]>>();

const DATES_TTL_MS = 5 * 60 * 1000;  // 5 min — month data changes infrequently
const TIMES_TTL_MS = 60 * 1000;       // 60 s — slot availability can shift as bookings land

function isFresh<T>(entry: CacheEntry<T>, ttl: number): boolean {
  return Date.now() - entry.fetchedAt < ttl;
}

export function bustBlockedDatesCache(tenantId: string, year: number, month: number): void {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  datesCache.delete(`bd:${tenantId}:${monthStr}`);
}
```

**Replace `fetchBlockedDates` inside the hook** (adds cache check and AbortController — see Problem 2 for why abort is also needed here):

```ts
let blockedDatesAbortController: AbortController | null = null;

async function fetchBlockedDates(tenantId: string, year: number, month: number): Promise<void> {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const cacheKey = `bd:${tenantId}:${monthStr}`;
  const cached = datesCache.get(cacheKey);
  if (cached && isFresh(cached, DATES_TTL_MS)) {
    blockedDates.value = cached.data;
    return;
  }

  if (blockedDatesAbortController) {
    blockedDatesAbortController.abort();
  }
  blockedDatesAbortController = new AbortController();
  const { signal } = blockedDatesAbortController;

  blockedDatesError.value = '';
  isFetchingDates.value = true;
  try {
    const res = await fetch(
      `/api/reservations/blocked-dates?tenant_id=${encodeURIComponent(tenantId)}&month=${monthStr}`,
      { signal },
    );
    if (!res.ok) {
      blockedDatesError.value = 'Could not load availability. Please try again.';
      return;
    }
    const data = (await res.json()) as BlockedDatesResponse;
    const resultSet = new Set<string>(data.blocked_dates ?? []);
    datesCache.set(cacheKey, { data: resultSet, fetchedAt: Date.now() });
    blockedDates.value = resultSet;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    blockedDatesError.value = 'Could not load availability. Please try again.';
  } finally {
    isFetchingDates.value = false;
  }
}
```

**Replace `fetchBlockedTimes` inside the hook** (adds cache check; keeps existing AbortController):

```ts
async function fetchBlockedTimes(tenantId: string, date: CalendarDate, guests: number): Promise<void> {
  const dateStr = formatDateForAPI(date);
  const cacheKey = `bt:${tenantId}:${dateStr}:${guests}`;
  const cached = timesCache.get(cacheKey);
  if (cached && isFresh(cached, TIMES_TTL_MS)) {
    blockedTimes.value = cached.data;
    return;
  }

  if (blockedTimesAbortController) {
    blockedTimesAbortController.abort();
  }
  blockedTimesAbortController = new AbortController();
  const { signal } = blockedTimesAbortController;

  isFetchingTimes.value = true;
  try {
    const res = await fetch(
      `/api/reservations/blocked-times?tenant_id=${encodeURIComponent(tenantId)}&date=${dateStr}&guests=${guests}`,
      { signal },
    );
    if (!res.ok) {
      blockedTimes.value = [];
      return;
    }
    const data = (await res.json()) as BlockedTimesResponse;
    const result = data.blocked_times ?? [];
    timesCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    blockedTimes.value = result;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    blockedTimes.value = [];
  } finally {
    isFetchingTimes.value = false;
  }
}
```

**Call `bustBlockedDatesCache` in `BookingApp.handleNewBooking`** after the booking completes, so the refreshed calendar reflects the just-made booking:

```ts
// BookingApp.tsx — handleNewBooking
import { bustBlockedDatesCache } from '@shared/hooks/useAvailability';

async function handleNewBooking() {
  resetForm();
  bookingRef.value = undefined;
  step.value = 'calendar';
  selectedDate.value = null;
  bustBlockedDatesCache(tenant.id, currentYear.value, currentMonth.value);
  await fetchBlockedDates(tenant.id, currentYear.value, currentMonth.value);
}
```

---

### 2. Consolidate duplicate `fetchBlockedDates` implementations

Extract a shared async utility so the cache and abort logic only exist once.

**Create `src/frontend/shared/utils/fetchBlockedDatesForMonth.ts`:**

```ts
import type { BlockedDatesResponse } from '@shared/types';

interface CacheEntry {
  data: Set<string>;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;
let abortController: AbortController | null = null;

export function bustMonth(tenantId: string, year: number, month: number): void {
  cache.delete(`${tenantId}:${year}-${String(month + 1).padStart(2, '0')}`);
}

export async function fetchBlockedDatesForMonth(
  tenantId: string,
  year: number,
  month: number,
): Promise<{ dates: Set<string>; aborted: boolean; error: boolean }> {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const key = `${tenantId}:${monthStr}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return { dates: cached.data, aborted: false, error: false };
  }

  if (abortController) abortController.abort();
  abortController = new AbortController();

  try {
    const res = await fetch(
      `/api/reservations/blocked-dates?tenant_id=${encodeURIComponent(tenantId)}&month=${monthStr}`,
      { signal: abortController.signal },
    );
    if (!res.ok) return { dates: new Set(), aborted: false, error: true };
    const data = (await res.json()) as BlockedDatesResponse;
    const dates = new Set<string>(data.blocked_dates ?? []);
    cache.set(key, { data: dates, fetchedAt: Date.now() });
    return { dates, aborted: false, error: false };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { dates: new Set(), aborted: true, error: false };
    }
    return { dates: new Set(), aborted: false, error: true };
  }
}
```

Then each caller — `useAvailability`, `useManageBooking`, and `CalendarPickerModal` — calls this function and handles the returned `{ dates, aborted, error }` object to update their local signals. All three get caching, AbortController, and consistent error messages for free.

---

### 3. AbortController for `fetchBlockedDates`

Covered by Optimisation 2. If the consolidation refactor is deferred, apply the abort pattern to each of the three existing implementations individually as a minimum fix. The pattern to copy is already in `useAvailability.fetchBlockedTimes` (lines 45–49 of `useAvailability.ts`) and `useManageBooking.fetchBlockedTimesForDate` (lines 162–166 of `useManageBooking.ts`).

Declare `let blockedDatesAbortController: AbortController | null = null` at the same scope as the existing `blockedTimesAbortController`, and add the abort-and-reassign block at the start of each `fetchBlockedDates` function.

---

### 4. Debounce guest count changes

**File:** `src/frontend/booking-widget/BookingApp.tsx`, `handleGuestsChange` (line 57).

Add a 250 ms debounce so that rapid spinner increments/decrements collapse to a single `fetchBlockedTimes` call:

```ts
let guestsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function handleGuestsChange(guests: number) {
  updateField('guests', guests);
  updateField('time', '');
  if (!selectedDate.value) return;

  if (guestsDebounceTimer !== null) clearTimeout(guestsDebounceTimer);
  guestsDebounceTimer = setTimeout(() => {
    fetchBlockedTimes(tenant.id, selectedDate.value!, guests);
  }, 250);
}
```

`guestsDebounceTimer` is a plain variable inside the component scope — no need for a signal or ref.

Note: 250 ms is imperceptible on a button press but more than enough to collapse a fast click sequence. If the guest input is a text field rather than a spinner, 300–400 ms is more appropriate.

---

### 5. Add double-submit guards to PATCH and DELETE mutations

**File:** `src/frontend/shared/hooks/useManageBooking.ts`

Three functions need guards. Mirror the pattern from `useBookingForm.ts` where `isSubmitting` is a signal declared at the hook's top level.

**Add signals** near line 50 of `useManageBooking.ts`:
```ts
const isSaving = useSignal(false);
const isCancelling = useSignal(false);
```

**Guard `saveEditDetails`** (line 203):
```ts
async function saveEditDetails(data: EditData): Promise<void> {
  if (isSaving.value) return;
  isSaving.value = true;
  // ... existing fetch logic ...
  // add `finally { isSaving.value = false; }` wrapping the try/catch
}
```

**Guard `saveDatetime`** (line 227):
```ts
async function saveDatetime(): Promise<void> {
  if (!selectedDate.value || !selectedTime.value) return;
  if (isSaving.value) return;
  isSaving.value = true;
  // ... existing fetch logic ...
  // add `finally { isSaving.value = false; }`
}
```

**Guard `confirmCancel`** (line 256):
```ts
async function confirmCancel(): Promise<void> {
  if (isCancelling.value) return;
  isCancelling.value = true;
  // ... existing fetch logic ...
  // add `finally { isCancelling.value = false; }`
}
```

Export `isSaving` and `isCancelling` from the hook return object so the `EditDetails`, `ChangeDateTime`, and `CancelConfirm` components can disable their submit buttons while in-flight.

---

### 6. HTTP `Cache-Control` headers on read endpoints

None of the three public read endpoints return `Cache-Control` headers. Add them in the Hono route handlers.

**`GET /api/reservations/blocked-dates`** (`src/routes/reservations.ts`, after line 89):
```ts
return c.json({ blocked_dates: Array.from(blockedSet) }, 200, {
  'Cache-Control': 'public, max-age=300',
});
```
`public, max-age=300` — 5 minutes. Matches the client-side TTL proposed in Optimisation 1. Month-level availability data does not change second-to-second; a 5-minute window is safe and means returning users' browsers serve the calendar from cache on the first repaint. `public` is appropriate because there is no user-specific data in this response (only tenant-level blocked dates).

**`GET /api/reservations/blocked-times`** (`src/routes/reservations.ts`, after line 176):
```ts
return c.json({ blocked_times: blockedTimes, time_limit_minutes: ... }, 200, {
  'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
});
```
`private, max-age=60, stale-while-revalidate=30` — slot availability is guest-count-specific (the `guests` query param changes the result), so `private` prevents shared/proxy caches from mixing results. 60 seconds is short enough that a genuinely full restaurant won't show ghost availability. `stale-while-revalidate=30` keeps the UI responsive during revalidation. Note: the `guests` param is part of the URL so distinct guest counts are distinct cache entries automatically.

**`GET /api/tenants/:id`** (`src/routes/tenants.ts`, after line 34):
```ts
return c.json({ ...tenant, opening_hours: results.length > 0 ? results : null }, 200, {
  'Cache-Control': 'public, max-age=3600',
});
```
`public, max-age=3600` — 1 hour. Tenant config (name, max covers, opening hours) is set by the restaurant owner and rarely changes during a session. 1 hour is a safe TTL; if an admin changes config they would expect a short propagation delay. `public` is safe because the `/api/tenants/:id` response is explicitly scrubbed of PII (`contact_email`, `created_date`, `modified_date` are excluded — confirmed in `tenants.ts` lines 19–21).

---

### 7. D1 index recommendations

A review of the migration files shows the most critical indexes are already applied:

- `idx_blocked_dates_tenant_date ON BlockedDates(tenant_id, date)` — **exists** (migration `0004_blocked_dates.sql`). Covers the `LIKE ?` prefix query in `blocked-dates` and the `date = ?` point query in `blocked-times`.
- `idx_reservations_tenant_date ON Reservations(tenant_id, reservation_date)` — **exists** (migration `0007_reservations_tenant_date_index.sql`). Covers the hot `SELECT reservation_time, guests FROM Reservations WHERE tenant_id = ? AND reservation_date = ?` in `blocked-times`.
- `OpeningHours(tenant_id, day_of_week)` — covered by the `UNIQUE (tenant_id, day_of_week)` constraint (migration `0005_opening_hours.sql`), which SQLite implements as an implicit B-tree index. Prefix lookups on `tenant_id` use this index.

No new `CREATE INDEX` statements are needed. The remaining queries (`SELECT id FROM Tenants WHERE id = ?` and `SELECT ... FROM Tenants WHERE id = ?`) use the `Tenants` primary key, which is always indexed.

The one query that does not benefit from any index is `SELECT day_of_week FROM OpeningHours WHERE tenant_id = ? AND is_closed = 1` in the `blocked-dates` handler. The UNIQUE index covers `tenant_id` prefix access, but `is_closed` is not in the index so SQLite scans all rows for the tenant and filters by `is_closed`. Since each tenant has at most 7 rows in `OpeningHours`, this is negligible — adding a covering index would add write overhead for zero measurable read benefit.

---

### 8. (Optional / future) Consolidate admin day-navigation requests

`useBookings.fetchBookings` (line 43 of `useBookings.ts`) always calls `fetchBlockState` after it completes (line 58). These two requests always go to the same date, always together, and always share the same auth token. They could be combined into a single endpoint:

```
GET /api/admin/day-summary?date=YYYY-MM-DD
→ { reservations: Reservation[], is_day_blocked: boolean, guest_count: number }
```

This halves the admin panel's request count per navigation and eliminates the current issue where `fetchBlockState` can reflect a different date if `fetchBookings` is called again before `fetchBlockState` completes. It also removes the need to track `isDayBlocked` and `guestCount` as separate derived signals.

This is a backend-plus-frontend change and is low priority given the admin panel's low traffic compared to the booking widget, but it is the cleanest long-term shape.

---

## Implementation Priority

| # | Change | File(s) | Effort | Impact | Do first? |
|---|--------|---------|--------|--------|-----------|
| 1 | Client-side cache for `fetchBlockedDates` and `fetchBlockedTimes` in `useAvailability` | `useAvailability.ts`, `BookingApp.tsx` | Low | High | ✅ Yes |
| 3 | AbortController for `fetchBlockedDates` | `useAvailability.ts`, `useManageBooking.ts`, `CalendarPickerModal.tsx` | Low | High | ✅ Yes |
| 5 | Double-submit guards on PATCH/DELETE in `useManageBooking` | `useManageBooking.ts` | Low | Medium | ✅ Yes |
| 6 | HTTP `Cache-Control` headers on read endpoints | `reservations.ts`, `tenants.ts` | Low | Medium | ✅ Yes |
| 4 | Debounce guest count changes | `BookingApp.tsx` | Low | Medium | ✅ Yes |
| 2 | Consolidate `fetchBlockedDates` into shared util | `useAvailability.ts`, `useManageBooking.ts`, `CalendarPickerModal.tsx`, new util file | Medium | High (maintainability) | After 1 & 3 |
| 7 | D1 indexes | N/A | None | N/A | No action needed — indexes exist |
| 8 | Combined admin day-summary endpoint | `useBookings.ts`, new backend route | Medium | Low | Backlog |

Items 1, 3, 5, 6, and 4 can all be done in the same pass — none of them touch overlapping logic and each is a contained, low-risk change. Do the consolidation refactor (item 2) in a follow-up once the individual fixes are tested, so the refactor is not load-bearing for correctness.

---

## What NOT to do

**Don't add `sessionStorage` or `localStorage` caching.** The in-memory `Map` approach (Optimisation 1) is sufficient for the booking session lifetime. Persisting availability data to storage risks showing stale blocked dates across page loads or tabs, which is worse than a redundant network request.

**Don't add a service worker or custom HTTP cache layer.** The `Cache-Control` headers (Optimisation 6) let the browser and Cloudflare's edge handle caching correctly with no bespoke cache infrastructure. A service worker adds complexity that is not warranted at this scale.

**Don't debounce `fetchBlockedTimes` on date selection.** The debounce in Optimisation 4 is specifically for the guest-count spinner. Date selection is intentional and infrequent — debouncing it would make the time picker visibly sluggish.

**Don't batch all availability data into a single "availability init" endpoint.** The current separation of `blocked-dates` (per month) and `blocked-times` (per date + guests) is the right granularity. A monolithic init payload would over-fetch (all dates × all guest counts) and make cache invalidation harder.

**Don't add server-side KV caching for D1 query results yet.** The D1 queries are fast (indexed), the Worker is at the edge, and the client-side TTL cache (Optimisation 1) already removes most repeat calls. KV introduces consistency complexity (invalidation on mutations) that isn't justified by the current query latency.
