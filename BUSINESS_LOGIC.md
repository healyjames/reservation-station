# Business Logic: Reservation Capacity

> **Data first.** This project is data-focused — the capacity rules below only make sense in terms of the underlying objects. For the definition of every object (`Tenant`, `Reservation`, the embedded customer, `AdminUser`, `BlockedDate`, `OpeningHours`), their columns, keys, and relationships, read [`documentation/DATA_MODEL.md`](documentation/DATA_MODEL.md). Fields referenced throughout this file (`max_covers`, `max_guests`, `concurrent_guests_time_limit`, `reservation_date`, `reservation_time`, `guests`, etc.) are all defined there.

## Rolling Occupancy Model

Maximum Bookings uses a **rolling occupancy model** to manage venue capacity. Capacity is a *concurrent* constraint, not a daily total.

### Core Principle

> At no moment may the guests seated in the venue exceed `max_covers`.

A booking starting at `T` occupies capacity for its whole **sitting**, `[T, T + concurrent_guests_time_limit)`. The end is exclusive, so a sitting that ends at 15:00 does not overlap one that starts at 15:00.

**Occupancy at a moment `P`** is the sum of guests of every booking with `start <= P < start + limit`.

**A new or moved booking fits** when, for every moment of its sitting, occupancy + its guests ≤ `max_covers`. Occupancy only rises when a booking starts, so it is enough to check the new booking's start and every existing booking start that falls inside its sitting. This means a booking is rejected if it would overlap a *later* booking and overflow, not just an earlier one.

---

## Configuration

| Field | Meaning | Where set |
|---|---|---|
| `max_covers` | Maximum concurrent guests (venue physical capacity). `0` = unlimited. | Admin › General › Max venue capacity |
| `concurrent_guests_time_limit` | Duration in minutes that each booking occupies capacity (e.g. 120 = 2-hour sitting). | Admin › General › Guest time window (minutes) |
| `max_guests` | Maximum party size per individual booking. `0` = unlimited. | Admin › General › Max party size (per booking) |

`max_covers` and `max_guests` are independent controls:
- `max_covers` limits how many guests can be *in the venue at once*.
- `max_guests` limits the size of any *single booking*.

---

## Booking Delay (Lead Time)

A tenant can set a **booking delay** (`booking_delay_minutes`) to prevent last-minute bookings. Customers cannot select a time that falls within `booking_delay_minutes` of the current moment.

| Field | Meaning | Where set |
|---|---|---|
| `booking_delay_minutes` | Minutes of lead time before the earliest bookable slot. `0` = no delay. Stored in minutes; the admin UI exposes it in hours (e.g. `1.5` hours → `90` minutes). | Admin › General › Booking delay (hours) |

**Example:** with `booking_delay_minutes = 90`, at 18:00 the earliest selectable slot is 19:30 (next 30-minute boundary at/after now + 90 min).

### Design & optimisation

- **Frontend-only.** The delay only affects the **Time** selector in the booking widget. It is not enforced server-side because it is a soft UX constraint, not a capacity/integrity rule.
- **No extra requests.** `booking_delay_minutes` is part of the public tenant config (`GET /api/tenants/:id`), which the widget already fetches once and caches (`Cache-Control: public, max-age=3600`). Since this value rarely changes, no additional API call is made when a date/time is chosen.
- **Applies to "today" only.** The delay window is measured from *now*, so it can only remove slots on the current day. Future dates are unaffected.

**Code reference:** `src/frontend/shared/utils/slots.ts` — `getAvailableSlots` calls `getEarliestTodaySlot(Math.max(30, booking_delay_minutes))` for today, keeping the existing 30-minute minimum lead as a floor.

---

## Examples

"Largest new party" is the biggest party that can book a sitting starting at that time.

### Example 1 — A full booking blocks every overlapping sitting

**Configuration:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`

| Booking | Time | Guests |
|---|---|---|
| A | 20:00 | 8 |

**Resulting occupancy:**

| Time window | Active covers |
|---|---|
| 20:00–21:59 | 8 |

**Availability:**

| New booking at | Largest new party |
|---|---|
| 18:00 or earlier | 8 (sitting ends as A arrives) |
| 18:30–21:30 | 0 (sitting overlaps A) |
| 22:00+ | 8 |

A booking at 18:00 is allowed. A booking at 19:00 is not, because its sitting runs until 21:00 and A is seated from 20:00. A booking at 22:00 is allowed again.

---

### Example 2 — Partial capacity reduces availability for overlapping sittings

**Configuration:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`

| Booking | Time | Guests |
|---|---|---|
| A | 20:00 | 6 |

**Resulting occupancy:**

| Time window | Active covers |
|---|---|
| 20:00–21:59 | 6 |

**Availability:**

| New booking at | Largest new party |
|---|---|
| 18:00 or earlier | 8 |
| 18:30–21:30 | 2 (only parties of 1–2 can book) |
| 22:00+ | 8 |

---

### Example 3 — Overlapping bookings create a step function

**Configuration:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`

| Booking | Time | Guests |
|---|---|---|
| A | 20:00 | 6 |
| B | 21:00 | 2 |

B's sitting (21:00–22:59) overlaps A's (20:00–21:59).

**Resulting occupancy:**

| Time window | Active covers |
|---|---|
| 20:00–20:59 | 6 (only A) |
| 21:00–21:59 | 8 (A + B) |
| 22:00–22:59 | 2 (only B, A has ended) |
| 23:00+ | 0 |

**Availability:**

| New booking at | Largest new party | Why |
|---|---|---|
| 18:00 or earlier | 8 | Sitting ends by 20:00 |
| 18:30–19:00 | 2 | Overlaps A only |
| 19:30–21:30 | 0 | Overlaps 21:00–21:59, when A + B are seated |
| 22:00–22:30 | 6 | Overlaps B only |
| 23:00+ | 8 | |

---

## Code References

### Core concurrent calculation

**`src/utils/slots.ts`**

- `calculateConcurrentGuests(slotTime, reservations, timeLimitMinutes)` — occupancy at one moment: guests of bookings with `start <= slot < start + limit`.
- `peakConcurrentGuests(startTime, reservations, timeLimitMinutes)` — highest occupancy during a sitting starting at `startTime` (checks the start and each booking start inside the sitting).

Also see `generateTimeSlots` in the same file for how available time slots are produced.

**`src/db/capacity.ts` — `capacityGuard`** builds the same whole-sitting rule as a SQL `WHERE` condition, so the capacity check and the write happen in one statement.

---

### API: booking creation guard

**`src/routes/reservations.ts` — `POST /api/reservations`** (also `POST /api/admin/reservations` and the customer `PATCH /api/reservations/:id`)

The `INSERT … SELECT … WHERE` (or `UPDATE … WHERE`) embeds `capacityGuard`, so occupancy is re-checked inside the same SQLite statement as the write. No row is written if the sitting would exceed `max_covers` at any moment, and the API returns **422**. `max_covers = 0` skips the check (unlimited). On PATCH the booking being amended is excluded from the count.

---

### API: blocked time slots

**`src/routes/availability.ts` — `GET /api/reservations/blocked-times`**

Returns the list of time strings that are unavailable for a given `(tenant_id, date, guests)` combination, plus `slots`: every bookable start time on that date from the effective opening hours (special hours if set for the date, otherwise the weekly hours). `slots` is empty when the date is closed or fully blocked. The widget and the manage-booking page build their time pickers from `slots`, not from the weekly hours in the tenant config, so special hours show correctly.

For each candidate time slot, marks it blocked if `peakConcurrentGuests(slot) + requested_guests > max_covers` — the same rule the booking guard enforces, so the widget never offers a time the server will reject for capacity.

Uses `max_covers` (concurrent capacity) — not `max_guests` (party size limit).

---

### API: per-slot capacity for one day

**`src/routes/availability.ts` — `GET /api/reservations/availability`**

Returns one day's default slots (`12:00`–`21:30`) with `concurrent_guests` and `available_capacity` at each slot's start time. It is a capacity read-out only.

**Known gap:** it ignores blocked dates, opening hours and the whole-sitting rule, so a slot it reports as having capacity may still be rejected. No frontend calls it. Use `blocked-times` to decide what is bookable.

---

### Frontend: party size selector

**`src/frontend/shared/components/BookingWidget/Step1Form.tsx`**

The guest count dropdown is bounded by:
```ts
const partyLimit = max_guests > 0
  ? max_guests
  : (max_covers > 0 ? max_covers : 20);
```

`max_guests` takes precedence over `max_covers` as the upper bound on party size.

---

### Frontend: fetching blocked times

**`src/frontend/shared/hooks/useAvailability.ts` — `fetchBlockedTimes`**

Called when a date is selected in the booking widget. Fetches `GET /api/blocked-times` and populates the `blockedTimes` signal, which `Step1Form` uses to disable unavailable time slots.

---

### Admin: configuration UI

**`src/frontend/shared/components/Admin/GeneralSettings.tsx`**

The **Max venue capacity** field sets `max_covers`. The **Max party size (per booking)** field sets `max_guests`. Both accept `0` to mean unlimited. The **Booking delay (hours)** field sets `booking_delay_minutes` (entered in hours, stored as minutes); `0` disables the delay.

---

## CORS Security Strategy

**`src/app.ts`**

In development (`ENVIRONMENT === 'development'`), all origins are allowed. In production, any HTTPS origin is permitted so the booking widget can be embedded on any restaurant website. Security is enforced by route-level credentials (admin JWT / manage token), not by origin-checking.

---

## Tenant Endpoint: PII Protection

**`src/routes/tenants.ts` — `GET /api/tenants/:id`**

The public tenant endpoint returns an explicit column allowlist: `id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit, booking_delay_minutes`. Fields such as `contact_email`, `created_date`, and `modified_date` are intentionally excluded to avoid leaking PII to unauthenticated callers. Use `GET /api/admin/me` for admin access to the full tenant record.

---

## Admin Tenant PATCH: Server-Side `modified_date`

**`src/routes/admin.ts` — `PATCH /api/admin/tenant`**

`modified_date` is injected server-side and removed from the client-submitted payload. This means the client can never fake a modification timestamp. `tenant_code` is also stripped from PATCH requests to prevent it from being changed.

---

## Tenant Onboarding

**`src/routes/tenants.ts` — `POST /api/tenants`**

Tenant onboarding is a super-admin operation gated by `X-Admin-Key` / `SUPER_ADMIN_KEY`. One request creates the tenant, first admin user, and all seven opening-hours rows atomically; omitted opening hours default to closed days until the owner configures them.

---

## Booking Creation: Validation Order

**`src/routes/reservations.ts` — `POST /api/reservations`**

Reservation creation validates in this order:
1. Full-day block check — rejects if the date has a full-day `BlockedDates` entry.
2. Partial-day time block check — rejects if the requested time falls within an admin-defined partial-day block (see [Blocked Dates](#blocked-dates)).
3. Opening hours check — uses the **effective hours** for the date (see [Special Opening Hours](#special-opening-hours)). Rejects if the venue is closed that day, or if the time is outside those hours (including midnight-crossing weekly schedules).
4. Capacity check — atomic INSERT with a WHERE clause (`capacityGuard`) that checks occupancy across the booking's whole sitting inside the same SQL statement, eliminating the SELECT-then-INSERT race condition.

---

## Blocked Dates

A `BlockedDate` row closes a tenant to new bookings for a **whole day** (no times) or for a **time range** on one date (`start_time` and `end_time`).

### Rules

- A time range is `[start_time, end_time)`. The start is blocked and the end is bookable, so "last booking 17:30" is a block from `18:00` to closing time.
- New blocks must use strict 24-hour `HH:MM` with `end_time > start_time`. A range cannot wrap past midnight and the latest possible end is `23:59` (there is no `24:00`). `reason` is optional, up to 200 characters.
- Rows created before this rule where `end_time <= start_time` are still honoured as wrapping past midnight.
- Blocks are not merged or de-duplicated. Overlapping ranges are allowed and a time is blocked if any range covers it.
- "Only bookable 12:00–16:00" is expressed as two ranges: opening→`12:00` and `16:00`→closing.
- **Blocks never touch existing reservations.** They only stop new bookings and moves.

### Where blocks are enforced

| Action | Full-day block | Time-range block |
|---|---|---|
| Customer creates a booking (`POST /api/reservations`) | Rejected, 422 | Rejected, 422 |
| Customer moves a booking to a new date or time (`PATCH /api/reservations/:id`) | Rejected, 422 | Rejected, 422 |
| Customer changes guests or details only (date and time unchanged) | Allowed | Allowed |
| Widget time picker (`GET /api/reservations/blocked-times`) | All slots blocked | Slots in the range blocked |
| Admin creates a booking (`POST /api/admin/reservations`) | Rejected, 422 | **Allowed** |
| Admin edits a booking (`PATCH /api/admin/reservations/:id`) | **Allowed** | **Allowed** |

The admin rows are an **intended override**: staff can place a booking inside a blocked time range (for example a private party during a blocked evening). Admin edits also skip the capacity check.

`src/db/blocked-dates.ts` — `findBlockError` is the single check used by the customer POST and PATCH. `src/utils/slots.ts` — `isTimeInBlock` / `isTimeInAnyBlock` hold the range rule, shared with `blocked-times`.

The widget caches `blocked-times` for 60 seconds, so a customer may briefly still see a newly blocked slot. Submitting it is rejected with 422.

### Admin UI

- **Bookings day view** (`Dashboard.tsx`): "Block this day" toggles a full-day block. When the visible day has time ranges, a read-only "Changed hours on this day" banner (`DayHoursBanner.tsx`) lists them, and its "Change these hours" link opens the specific-day view (`#/settings/opening-hours/specific-day`).
- **Opening Hours** (admin drawer, `#/settings/opening-hours`): a "Change hours for a specific day" button opens `SpecificDayHours.tsx` at `#/settings/opening-hours/specific-day`, in place of the weekly schedule; "Back to opening hours" returns. The admin picks a day on the shared calendar, then adds a time range with the `DayTimeBlocks.tsx` form. The view lists the viewed month's ranges, each with Remove (`DELETE /api/admin/blocked-dates/:id`). The same list (`ChangedHoursList.tsx`, data from `useMonthTimeBlocks.ts`) also appears under the weekly schedule for the current month.
- The From/Until choices are 30-minute steps bounded by that weekday's opening hours. Until only offers times after From, and its last option is closing time. The form enters blocked ranges only; there is no "bookable window" mode.
- Opening hours are fetched from `GET /api/admin/opening-hours` when the specific-day view opens (`useOpeningHours.ts`). The admin login response does not carry them.
- On a closed day, or a day whose hours run past midnight, the block form is replaced by an explanation. Existing ranges on that day can still be removed. Ranges that wrap past midnight can no longer be created anywhere. Setting special opening hours for the day makes the block form available.
- With no opening hours configured, the default `12:00`–`22:00` is used.
- **Blocked Dates** (admin drawer, `#/settings/blocked-dates`) manages full-day blocks only and does not show time ranges.

---

## Special Opening Hours

A `DateOverride` row gives one specific date its own opening hours. It **replaces** the weekly hours for that date only, so it can do what a block cannot: open earlier or later than normal, or open on a normally closed day. It can also close a normally open day.

### Effective hours for a date

Resolved by `src/db/opening-hours.ts` — `getEffectiveHours`, in this order:

1. A full-day `BlockedDate` on the date: not bookable, whatever the hours say.
2. A `DateOverride` for the date: its hours (or closed) apply, and the weekly row is ignored.
3. The weekly `OpeningHours` row for that weekday.
4. Nothing configured: open on the default `12:00`–`22:00`.

Time-range blocks are then applied inside whichever hours won.

### Rules

- Special hours must be strict `HH:MM` with close after open. They cannot run past midnight.
- One per date. Saving again replaces it. Removing it returns the date to its weekly hours.
- **Existing reservations are never changed**, including ones that now fall outside the special hours.
- Blocks vs special hours: use special hours to say when the venue is open that day ("Boxing Day 12:00–16:00"). Use a block to take a gap out of the day ("closed 15:00–17:00 for a private party"). Both can be set on the same date.

### Where special hours are applied

| Action | Uses effective hours? |
|---|---|
| Customer creates a booking (`POST /api/reservations`) | Yes — outside the hours or closed → 422 |
| Widget calendar (`GET /api/reservations/blocked-dates`, `closed_dates`) | Yes — a specially opened day is not listed, a specially closed day is |
| Widget and manage-booking time pickers (`GET /api/reservations/blocked-times`, `slots`) | Yes |
| Customer moves a booking (`PATCH /api/reservations/:id`) | **No** — this route has never checked opening hours; only blocks and capacity. The time picker only offers valid times. Known gap. |
| Admin creates or edits a booking | **No** — intended override, as for weekly hours |

### Admin UI and API

- **Opening Hours › "Change hours for a specific day"** (`#/settings/opening-hours/specific-day`): after picking a day, "Opening hours on this day" (`SpecialHoursForm.tsx`) shows the normal hours and sets, updates or removes special hours. Any day can be picked, including normally closed ones. The block form below it is then bounded by the special hours.
- "Changed hours in <month>" lists special hours alongside blocked ranges, each with Remove.
- **Bookings day view**: the "Changed hours on this day" banner shows special hours for the visible day (`useDateOverrides.ts`).
- The UI only sets special hours (open with times). Closing a whole day is done with "Block this day". The API also accepts `is_closed: true`.
- API: `GET /api/admin/date-overrides?month=YYYY-MM`, `PUT /api/admin/date-overrides/:date`, `DELETE /api/admin/date-overrides/:date` (`src/routes/date-overrides.ts`).

---

## Manage Token: Regenerated on Email Change

**`src/routes/reservations.ts` — `PATCH /api/reservations/:id`** (customer-facing)

When a customer amends their email address, the manage token is regenerated and the new hash is stored. This keeps the amendment/cancellation email link valid for the new email address.

---

## `contact_email` Field Availability

**`src/frontend/shared/types/tenant.ts` — `TenantConfig`**

The `contact_email` field is only present when `TenantConfig` is loaded via admin-authenticated endpoints (e.g. `GET /api/admin/me`). It is intentionally absent from the public `GET /api/tenants/:id` widget endpoint to prevent PII exposure.
