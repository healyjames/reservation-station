# Business Logic: Reservation Capacity

## Rolling Occupancy Model

Maximum Bookings uses a **rolling occupancy model** to manage venue capacity. Capacity is a *concurrent* constraint, not a daily total.

### Core Principle

> At any point in time, the sum of all active bookings (those whose sitting window overlaps with a given time slot) must not exceed `max_covers`.

A booking occupies capacity for a fixed duration defined by `concurrent_guests_time_limit`. Two bookings are **concurrent** if the absolute difference between their start times is less than `concurrent_guests_time_limit` minutes.

---

## Configuration

| Field | Meaning | Where set |
|---|---|---|
| `max_covers` | Maximum concurrent guests (venue physical capacity). `0` = unlimited. | Admin › General Settings › Max capacity |
| `concurrent_guests_time_limit` | Duration in minutes that each booking occupies capacity (e.g. 120 = 2-hour sitting). | Admin › General Settings |
| `max_guests` | Maximum party size per individual booking. `0` = unlimited. | Admin › General Settings › Max party size (per booking) |

`max_covers` and `max_guests` are independent controls:
- `max_covers` limits how many guests can be *in the venue at once*.
- `max_guests` limits the size of any *single booking*.

---

## Examples

### Example 1 — Full capacity blocks the window only

**Configuration:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`

| Booking | Time | Guests |
|---|---|---|
| A | 20:00 | 8 |

**Resulting occupancy:**

| Time window | Active covers |
|---|---|
| 20:00–22:00 | 8 |

**Availability:**

| Time | Remaining capacity |
|---|---|
| Before 20:00 | 8 (full capacity available) |
| 20:00–21:59 | 0 (fully booked) |
| 22:00+ | 8 (fully available again) |

A booking at 18:00 is allowed. A booking at 20:30 is not. A booking at 22:00 is allowed again.

---

### Example 2 — Partial capacity reduces availability in the window

**Configuration:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`

| Booking | Time | Guests |
|---|---|---|
| A | 20:00 | 6 |

**Resulting occupancy:**

| Time window | Active covers |
|---|---|
| 20:00–22:00 | 6 |

**Availability:**

| Time | Remaining capacity |
|---|---|
| 20:00–21:59 | 2 (only parties of 1–2 can book) |
| 22:00+ | 8 |

---

### Example 3 — Overlapping bookings create a step function

**Configuration:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`

| Booking | Time | Guests |
|---|---|---|
| A | 20:00 | 6 |
| B | 21:00 | 2 |

Booking B at 21:00 is concurrent with Booking A (|21:00 - 20:00| = 60 min < 120 min).

**Resulting occupancy:**

| Time window | Active covers |
|---|---|
| 20:00–20:59 | 6 (only A) |
| 21:00–21:59 | 8 (A + B) |
| 22:00–22:59 | 2 (only B, A has ended) |
| 23:00+ | 0 |

**Availability:**

| Time | Remaining capacity |
|---|---|
| 20:00–20:59 | 2 |
| 21:00–21:59 | 0 (fully booked) |
| 22:00–22:59 | 6 |
| 23:00+ | 8 |

---

## Code References

### Core concurrent calculation

**`src/utils/slots.ts` — `calculateConcurrentGuests`**

```ts
export function calculateConcurrentGuests(
  slotTime: string,           // "HH:MM"
  reservations: SlotReservation[],
  timeLimitMinutes: number
): number
```

Returns the total guests from all reservations whose start time is within `timeLimitMinutes` of `slotTime`. Two bookings are concurrent when `|slot - booking| < timeLimitMinutes`.

Also see `generateTimeSlots` in the same file for how available time slots are produced.

---

### API: booking creation guard

**`src/routes/reservations.ts` — `POST /api/reservations`**

When a reservation is submitted, the API:
1. Fetches all existing reservations for `(tenant_id, reservation_date)`.
2. Calls `calculateConcurrentGuests(reservation_time, dayReservations, concurrent_guests_time_limit)`.
3. Rejects with **422** if `concurrent + new_guests > max_covers`.
4. `max_covers = 0` skips the check entirely (unlimited).

---

### API: blocked time slots

**`src/routes/reservations.ts` — `GET /api/blocked-times`**

Returns the list of time strings that are unavailable for a given `(tenant_id, date, guests)` combination.

For each candidate time slot, calls `calculateConcurrentGuests` and marks the slot as blocked if `concurrent + requested_guests > max_covers`.

Uses `max_covers` (concurrent capacity) — not `max_guests` (party size limit).

---

### API: full availability grid

**`src/routes/reservations.ts` — `GET /api/availability`**

Returns a full month's worth of dates and their available time slots. Each slot is evaluated using the same concurrent window logic. Dates where all time slots are blocked are marked as unavailable.

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

The **Max capacity** field sets `max_covers`. The **Max party size (per booking)** field sets `max_guests`. Both accept `0` to mean unlimited.
