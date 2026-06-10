# Maximum Bookings

A multi-tenant restaurant reservation system built on Cloudflare's developer platform. Tenants (restaurants, pubs, cafes etc) are configured via the API; guests book through multi-entry Preact frontend surfaces served alongside the Worker.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                     │
│                                                          │
│  Static frontend assets              REST API (/api/*)   │
│  ────────────────────────            ─────────────────   │
│  src/frontend/* HTML entries         Hono route modules  │
│  dist/assets/* Vite bundles          /api/tenants        │
│  public/*.css + fonts + theme.js     /api/reservations   │
│                                           │              │
│                                    D1 SQLite database    │
└──────────────────────────────────────────────────────────┘
```

The Worker serves two things from a single deployment:

- **Static frontend** - Vite-built Preact surfaces from `src/frontend`, plus copied assets from `public`, served from `dist/` via [Cloudflare Assets](https://developers.cloudflare.com/workers/static-assets/)
- **REST API** - Hono routes at `/api/*` backed by a [D1](https://developers.cloudflare.com/d1/) database

### Project Structure

```
src/
  index.ts               # Worker entry point (exports Hono app)
  app.ts                 # Route mounting + middleware (logger, CORS)
  routes/
    tenants.ts           # GET/POST/PATCH/DELETE /api/tenants
    reservations.ts      # GET/POST/PATCH/DELETE /api/reservations
  frontend/
    index.html           # Canonical root booking entry
    booking-widget/      # Named booking widget surface
    booking/manage/      # Booking management surface
    admin/               # Admin surface
    cancel/              # Cancellation surface
    shared/              # Shared hooks, components, utils, types

public/
  shared.css             # Shared global tokens/layout styles
  styles.css             # Booking widget global styles
  admin/styles/admin.css # Admin global styles
  fonts/                 # Self-hosted Google Sans variable fonts
  js/theme.js            # Blocking theme bootstrap
```

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `preact` | Lightweight frontend UI runtime |
| `hono` | Lightweight API framework for Workers |
| `zod` | Request body validation + schema-derived TypeScript types |
| `vite` | Multi-entry frontend build |
| `wrangler` | CLI for local dev, D1 migrations, and deployment |

---

## Tenant Config

The app is multi-tenant. Each tenant represents a venue and is identified by a `tenant_code` slug (e.g. `the-oak-room`). Public booking surfaces read the tenant from the URL query string:

```
https://your-worker.workers.dev/?tenant=the-oak-room
```

The booking widget loads tenant configuration through `src/frontend/shared/hooks/useTenant.ts`, which fetches `/api/tenants/:tenant_code` and exposes loading, ready, and error states to the Preact surface.

### Tenant Fields

| Field | Type | Effect on UI |
|-------|------|-------------|
| `name` | `string` | Venue display name |
| `tenant_code` | `string` | URL identifier (lowercase, alphanumeric, hyphens) |
| `max_guests` | `number` | Upper bound of the guests dropdown (min is always 2) |
| `max_covers` | `number` | Total covers available (for reservation capacity logic) |
| `status` | `active \| cancelled` | Cancelled tenants can be rejected at API level |
| `block_current_day` | `boolean` | If `true`, today's date is disabled on the calendar |
| `opening_hours` | `array` | Drives per-day slot generation and closed-day handling |

### Frontend usage

The booking widget surface uses the tenant payload to:

- cap guest-count options
- compute available slots from opening hours
- disable blocked or closed days
- send the resolved `tenant_id` in reservation requests

---

## Frontend API Usage

The table below shows which frontend hooks call which API endpoints and why. Public endpoints are called from customer-facing surfaces (booking widget, cancel, manage pages) with no auth token. Admin endpoints require a Bearer JWT.

| Endpoint | Auth | Called from | Purpose |
|----------|------|-------------|---------|
| `GET /api/tenants/:id` | None | `useTenant.ts` | Load tenant config (name, capacity, opening hours) when the widget initialises |
| `GET /api/reservations/blocked-dates` | None | `useAvailability.ts`, `useManageBooking.ts` | Disable unavailable dates on the booking calendar |
| `GET /api/reservations/blocked-times` | None | `useAvailability.ts`, `useManageBooking.ts` | Grey out full or blocked time slots in the time picker |
| `GET /api/reservations/daily-capacity` | None | `useAvailability.ts` | Show remaining covers banner in booking step 1 |
| `POST /api/reservations` | None | `useBookingForm.ts` | Submit a new reservation from the public booking widget |
| `GET /api/reservations/:id` | None | `useManageBooking.ts`, `useCancelBooking.ts` | Load an existing booking on the manage/cancel pages |
| `PATCH /api/reservations/:id` | None | `useManageBooking.ts` | Customer amends their booking date, time, or details |
| `DELETE /api/reservations/:id` | None | `useManageBooking.ts`, `useCancelBooking.ts` | Customer cancels their booking |
| `POST /api/auth/login` | None | `useAuth.ts` | Admin login — returns JWT on success |
| `GET /api/admin/reservations` | JWT | `useBookings.ts` | Load the reservation list for the admin day view |
| `DELETE /api/admin/reservations/:id` | JWT | `useBookings.ts` | Admin deletes a reservation |
| `GET /api/admin/blocked-dates` | JWT | `useBookings.ts` | Check whether the current day is blocked |
| `POST /api/admin/blocked-dates` | JWT | `useBookings.ts` | Admin blocks a day |
| `DELETE /api/admin/blocked-dates/date/:date` | JWT | `useBookings.ts` | Admin unblocks a day |
| `GET /api/admin/me` | JWT | Admin settings | Load the authenticated tenant's config |
| `PATCH /api/admin/me` | JWT | Admin settings | Save changes to tenant config |
| `GET /api/admin/opening-hours` | JWT | Admin settings | Load the tenant's opening hours |
| `PUT /api/admin/opening-hours` | JWT | Admin settings | Save the tenant's opening hours |
| `GET /api/reservations` | JWT | *(not used by frontend — admin API only)* | List reservations scoped to the authenticated tenant |

---

## API Reference

All endpoints return JSON. Error responses have the shape `{ "error": "..." }`.

---

### Tenants

#### `GET /api/tenants`

Returns all tenants.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "name": "The Oak Room",
    "tenant_code": "the-oak-room",
    "max_guests": 10,
    "max_covers": 50,
    "status": "active",
    "block_current_day": false,
    "concurrent_guests_time_limit": 120,
    "created_date": "2024-01-01T00:00:00.000Z",
    "modified_date": "2024-01-01T00:00:00.000Z"
  }
]
```

---

#### `GET /api/tenants/:tenant_code`

Returns a single tenant matched by `tenant_code`.

**Path parameter**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tenant_code` | `string` | The tenant's URL slug (e.g. `the-oak-room`) |

**Response `200`** - tenant object (see above)

**Errors**

| Code | Meaning |
|------|---------|
| `404` | Tenant not found |

---

#### `POST /api/tenants`

Creates a new tenant.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | Display name |
| `tenant_code` | `string` | ✅ | URL slug - lowercase alphanumeric + hyphens, max 50 chars |
| `max_guests` | `integer ≥ 0` | ✅ | Upper bound for the guests dropdown; `0` = no limit |
| `max_covers` | `integer ≥ 0` | ✅ | Total covers per day; `0` = no limit |
| `status` | `"active" \| "cancelled"` | ✅ | Tenant status |
| `block_current_day` | `boolean` | ✅ | Disables same-day bookings when `true` |
| `concurrent_guests_time_limit` | `integer > 0` | ❌ | Overlap window in minutes (default `120`) |

**Response `201`** - created tenant object (all fields including `id`, `created_date`, `modified_date`)

**Errors**

| Code | Meaning |
|------|---------|
| `400` | Validation failed |
| `500` | Database insert failed |

---

#### `PATCH /api/tenants/:id`

Partially updates a tenant. All body fields are optional; supply only what you want to change.

**Path parameter**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `uuid` | Tenant UUID |

**Request body** - any subset of the `POST` fields (all optional)

**Response `200`**
```json
{ "success": true }
```

**Errors**

| Code | Meaning |
|------|---------|
| `400` | Validation failed or no valid fields supplied |
| `500` | Database update failed |

---

#### `DELETE /api/tenants/:id`

Deletes a tenant.

**Path parameter**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `uuid` | Tenant UUID |

**Response `200`**
```json
{ "success": true }
```

**Errors**

| Code | Meaning |
|------|---------|
| `404` | Tenant not found |
| `500` | Database delete failed |

---

### Reservations

#### `GET /api/reservations/blocked-times`

Returns the time slots that cannot accept a given party size on a given date, based on the concurrent guest limit. Used by the booking widget to grey out unavailable times.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | `uuid` | ✅ | Tenant UUID |
| `date` | `string` | ✅ | Date in `YYYY-MM-DD` format |
| `guests` | `integer > 0` | ✅ | Number of guests in the prospective booking |

**Response `200`**
```json
{
  "blocked_times": ["12:00", "12:30", "19:00"],
  "time_limit_minutes": 120
}
```

`blocked_times` lists every 30-minute slot (from `12:00` to `21:30`) where adding `guests` would exceed `max_guests` within the `concurrent_guests_time_limit` window. Returns an empty array when `max_guests = 0` (no limit).

**Errors**

| Code | Meaning |
|------|---------|
| `400` | Missing or invalid query parameters |
| `404` | Tenant not found |

---

#### `GET /api/reservations/availability`

Returns per-slot capacity data for a date. Intended for admin dashboards or integrations that need to see the full picture.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | `uuid` | ✅ | Tenant UUID |
| `date` | `string` | ✅ | Date in `YYYY-MM-DD` format |

**Response `200`**
```json
{
  "date": "2024-06-15",
  "max_covers": 50,
  "time_limit_minutes": 120,
  "slots": [
    { "time": "12:00", "concurrent_guests": 8, "available_capacity": 42 },
    { "time": "12:30", "concurrent_guests": 12, "available_capacity": 38 }
  ]
}
```

`slots` covers every 30-minute interval from `12:00` to `21:30`. `concurrent_guests` is the number of guests from existing reservations whose times fall within `time_limit_minutes` of that slot. `available_capacity` is `max(0, max_covers − concurrent_guests)`.

**Errors**

| Code | Meaning |
|------|---------|
| `400` | Missing or invalid query parameters |
| `404` | Tenant not found |

---

#### `GET /api/reservations`

> **Requires authentication** — `Authorization: Bearer <token>` header required. Results are automatically scoped to the authenticated tenant; the `tenant_id` query parameter is no longer accepted.

Returns the authenticated tenant's reservations, optionally filtered by date. Results are ordered by `reservation_date` then `reservation_time` ascending.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | `string` | ❌ | Filter by date (`YYYY-MM-DD`) |

**Response `200`** - array of reservation objects

```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "first_name": "Jane",
    "surname": "Smith",
    "telephone": "+44 7700 900000",
    "email": "jane@example.com",
    "reservation_date": "2024-06-15",
    "reservation_time": "19:30",
    "guests": 4,
    "dietary_requirements": "Nut allergy",
    "created_date": "2024-01-01T00:00:00.000Z",
    "modified_date": "2024-01-01T00:00:00.000Z"
  }
]
```

---

#### `GET /api/reservations/:id`

Returns a single reservation by UUID.

**Path parameter**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `uuid` | Reservation UUID |

**Response `200`** - reservation object (see above)

**Errors**

| Code | Meaning |
|------|---------|
| `404` | Reservation not found |

---

#### `POST /api/reservations`

Creates a new reservation. Enforces the `max_covers` daily limit and the `block_current_day` rule.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenant_id` | `uuid` | ✅ | Tenant UUID |
| `first_name` | `string` | ✅ | Max 50 chars |
| `surname` | `string` | ✅ | Max 50 chars |
| `telephone` | `string` | ✅ | 7–15 digits; `+` and spaces/hyphens allowed |
| `email` | `string` | ✅ | Valid email address |
| `reservation_date` | `string` | ✅ | `YYYY-MM-DD` |
| `reservation_time` | `string` | ✅ | `HH:MM` (24-hour, e.g. `"19:30"`) |
| `guests` | `integer > 0` | ✅ | Party size |
| `dietary_requirements` | `string` | ❌ | Max 500 chars |

**Response `201`** - created reservation object (all fields including `id`, `created_date`, `modified_date`)

**Errors**

| Code | Meaning |
|------|---------|
| `400` | Validation failed |
| `404` | Tenant not found |
| `422` | Same-day booking blocked (`block_current_day = true`) or adding this party would exceed `max_covers` for the date |
| `500` | Database insert failed |

---

#### `PATCH /api/reservations/:id`

Partially updates a reservation. `tenant_id` cannot be changed.

**Path parameter**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `uuid` | Reservation UUID |

**Request body** - any subset of `first_name`, `surname`, `telephone`, `email`, `reservation_date`, `reservation_time`, `guests`, `dietary_requirements` (all optional)

**Response `200`**
```json
{ "success": true }
```

**Errors**

| Code | Meaning |
|------|---------|
| `400` | Validation failed or no valid fields supplied |
| `500` | Database update failed |

---

#### `DELETE /api/reservations/:id`

Deletes a reservation.

**Path parameter**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `uuid` | Reservation UUID |

**Response `200`**
```json
{ "success": true }
```

**Errors**

| Code | Meaning |
|------|---------|
| `404` | Reservation not found |
| `500` | Database delete failed |

---

## Local Development

```bash
# Install dependencies
npm install

# Create the local D1 database
npx wrangler d1 execute maximum_bookings_db --local --file=./src/db/schema.sql

# Start local dev server (Worker + static assets on http://localhost:8787)
npx wrangler dev

# Regenerate TypeScript types after changing wrangler.jsonc bindings
npm run cf-typegen
```

## Deployment

```bash
# Deploy to Cloudflare Workers
npx wrangler deploy

# Run D1 migrations against the remote database
npx wrangler d1 execute maximum_bookings_db --file=./migrations/<migration>.sql
```

.
