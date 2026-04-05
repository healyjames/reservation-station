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

### Tenant API

```http
GET    /api/tenants              # List all tenants
GET    /api/tenants/:tenant_code # Get single tenant by code
POST   /api/tenants              # Create tenant
PATCH  /api/tenants/:id          # Update tenant (partial)
DELETE /api/tenants/:id          # Delete tenant
```

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
