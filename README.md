# maximum-bookings

A multi-tenant restaurant reservation system built on Cloudflare's developer platform. Tenants (restaurants, pubs, cafes etc) are configured via the API; guests book a table through a vanilla JS frontend served as static assets.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Cloudflare Workers                  │
│                                                 │
│  Static Assets (/public)   REST API (/api/*)    │
│  ─────────────────────   ───────────────────    │
│  index.html               Hono framework        │
│  styles.css               /api/tenants CRUD     │
│  js/*.js                  /api/reservations      │
│                                │                │
│                         D1 SQLite database      │
└─────────────────────────────────────────────────┘
```

The Worker serves two things from a single deployment:

- **Static frontend** — HTML/CSS/JS from `./public`, served at `/` via [Cloudflare Assets](https://developers.cloudflare.com/workers/static-assets/)
- **REST API** — Hono routes at `/api/*` backed by a [D1](https://developers.cloudflare.com/d1/) database

### Project Structure

```
src/
  index.ts          # Worker entry point (exports Hono app)
  app.ts            # Route mounting + middleware (logger, CORS)
  routes/
    tenants.ts      # GET/POST/PATCH/DELETE /api/tenants
    reservations.ts # GET/POST/PATCH/DELETE /api/reservations
  db/
    schema.ts       # Zod schemas + TypeScript types
    schema.sql      # D1 table definitions

public/
  index.html
  styles.css
  js/
    tenants.js      # Tenant config — shared singleton
    calendar.js     # Calendar UI + page entry point
    booking-form.js # Multi-step booking form
    theme.js        # Theme utilities
```

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | Lightweight API framework for Workers |
| `zod` | Request body validation + schema-derived TypeScript types |
| `wrangler` | CLI for local dev, D1 migrations, and deployment |

---

## Tenant Config

The app is multi-tenant. Each tenant represents a venue and is identified by a `tenant_code` slug (e.g. `the-oak-room`). The frontend reads the tenant from the URL query string:

```
https://your-worker.workers.dev/?tenant=the-oak-room
```

On load, `calendar.js` calls `loadTenant()` which fetches the config and stores it as the exported `tenantConfig` object — an ES module singleton shared across all JS modules.

### Tenant Fields

| Field | Type | Effect on UI |
|-------|------|-------------|
| `name` | `string` | Venue display name |
| `tenant_code` | `string` | URL identifier (lowercase, alphanumeric, hyphens) |
| `max_guests` | `number` | Upper bound of the guests dropdown (min is always 2) |
| `max_covers` | `number` | Total covers available (for reservation capacity logic) |
| `status` | `active \| cancelled` | Cancelled tenants can be rejected at API level |
| `block_current_day` | `boolean` | If `true`, today's date is disabled on the calendar |

### Accessing Tenant Config in JS

`tenantConfig` is a plain JS object exported from `tenants.js`. Because ES modules are singletons, any module that imports it gets the same populated reference after `loadTenant()` resolves.

```js
// In any frontend module
import { tenantConfig } from './tenants.js';

// Read a field
const max = tenantConfig?.max_guests ?? 20;

// Guard against config not yet loaded
if (!tenantConfig) {
  console.warn('Tenant config not available yet');
}
```

**How the booking form uses it:**

```js
// Guests dropdown — options from 2 to max_guests
Array.from(
  { length: (tenantConfig?.max_guests ?? 20) - 1 },
  (_, i) => i + 2
)

// Calendar — disable today if block_current_day is set
const isBlockedToday = isToday && tenantConfig?.block_current_day === true;

// Reservation submission — tenant ID comes from config
const requestBody = {
  tenant_id: tenantConfig.id,
  // ...
};
```

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

**Response `200`** — tenant object (see above)

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
| `tenant_code` | `string` | ✅ | URL slug — lowercase alphanumeric + hyphens, max 50 chars |
| `max_guests` | `integer ≥ 0` | ✅ | Upper bound for the guests dropdown; `0` = no limit |
| `max_covers` | `integer ≥ 0` | ✅ | Total covers per day; `0` = no limit |
| `status` | `"active" \| "cancelled"` | ✅ | Tenant status |
| `block_current_day` | `boolean` | ✅ | Disables same-day bookings when `true` |
| `concurrent_guests_time_limit` | `integer > 0` | ❌ | Overlap window in minutes (default `120`) |

**Response `201`** — created tenant object (all fields including `id`, `created_date`, `modified_date`)

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

**Request body** — any subset of the `POST` fields (all optional)

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

Returns reservations, optionally filtered. Results are ordered by `reservation_date` then `reservation_time` ascending.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | `uuid` | ❌ | Filter by tenant |
| `date` | `string` | ❌ | Filter by date (`YYYY-MM-DD`) |

**Response `200`** — array of reservation objects

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

**Response `200`** — reservation object (see above)

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

**Response `201`** — created reservation object (all fields including `id`, `created_date`, `modified_date`)

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

**Request body** — any subset of `first_name`, `surname`, `telephone`, `email`, `reservation_date`, `reservation_time`, `guests`, `dietary_requirements` (all optional)

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
