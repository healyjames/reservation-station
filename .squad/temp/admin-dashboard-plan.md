# Admin Dashboard Plan - Maximum Bookings

> Squad v0.9.1 | Prepared by: Squad (Coordinator) | Requested by: James Healy
> **Status: DECISIONS CONFIRMED - ready to implement**

---

## 1. What We're Building

A secure, simple admin dashboard for venue owners (café / pub / restaurant) that lets them:

- **Log in** with email + password (scoped to their venue)
- **View bookings** for any given day, sorted by time
- **Edit a booking** - change date, time, guests, dietary requirements, contact info
- **Delete a booking** - with a confirmation step
- **Update their venue settings** - name, max guests, max covers, block same-day, etc. (update only, never delete)

Venue owners only ever see **their own data**. Tenant isolation is enforced at every API layer.

---

## 2. Authentication - Decision: Custom JWT via Web Crypto API

✅ **Decided: Roll our own JWT auth using the Cloudflare Workers Web Crypto API.**

- Uses the Web Crypto API built into Cloudflare Workers - no library needed
- `PBKDF2` for password hashing (built-in, no bcrypt dependency issues)
- Short-lived JWT (8h expiry), signed with `HMAC-SHA256`
- Secret key stored as a Wrangler secret (`JWT_SECRET`)
- No external services, no monthly cost, no data leaving your infrastructure
- Token stored in `localStorage` on the client - acceptable for an admin-only tool
- Easy to understand, audit, and extend

**What we'd need to add:**

1. `AdminUsers` DB table (migration)
2. `POST /api/auth/login` - returns JWT
3. Hono middleware that validates JWT on `/api/admin/*` routes
4. Client-side logout (clear token from localStorage)

---

## 3. Database Changes

### New Migration: `0002_admin_users.sql`

```sql
CREATE TABLE AdminUsers (
    id          TEXT PRIMARY KEY NOT NULL,
    tenant_id   TEXT NOT NULL,
    email       TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    modified_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_admin_users_email ON AdminUsers(email);
CREATE INDEX idx_admin_users_tenant ON AdminUsers(tenant_id);
```

> **Note:** No seeded credentials in SQL. An `npm run seed:admin` script or a one-time setup endpoint should handle initial user creation safely.

---

## 4. Backend - New API Routes

All new routes live under `/api/auth/*` and `/api/admin/*`.

### Auth Routes (public)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/login` | Accepts `{ email, password }`, returns `{ token, tenant }` |

### Admin Routes (JWT-protected)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/me` | Returns the authenticated tenant's details |
| `PATCH` | `/api/admin/me` | Updates the authenticated tenant's details |
| `GET` | `/api/admin/reservations?date=YYYY-MM-DD` | Lists bookings for a given day (own tenant only) |
| `PATCH` | `/api/admin/reservations/:id` | Updates a specific booking (own tenant only) |
| `DELETE` | `/api/admin/reservations/:id` | Deletes a specific booking (own tenant only) |

**Tenant isolation rule:** Every admin route must verify that the resource being accessed belongs to the authenticated tenant. The JWT payload carries `tenant_id` - this is the source of truth, never a user-supplied parameter.

### Hono Auth Middleware

```
/api/admin/* → jwtMiddleware → route handler
```

The middleware:
1. Reads `Authorization: Bearer <token>` header
2. Verifies signature with `JWT_SECRET`
3. Checks expiry
4. Attaches `{ userId, tenantId }` to context
5. Rejects with `401` if invalid or expired

---

## 5. Frontend - Admin Dashboard

A separate SPA-style set of pages under `public/admin/`. Consistent with the existing widget's aesthetic (warm burgundy palette, same fonts, same design language).

### Pages / Views

```
public/admin/
├── index.html          ← Login page (redirect to dashboard if token exists)
├── dashboard.html      ← Main dashboard
├── styles/
│   └── admin.css       ← Admin-specific styles (extends existing theme vars)
└── js/
    ├── auth.js         ← Login form, token storage, logout
    ├── dashboard.js    ← Booking list, date picker, day summary
    ├── booking-modal.js ← Edit / delete booking modal
    └── settings.js     ← Tenant settings form
```

### Dashboard UI

- **Date picker** at the top - browse any date forward/backward
- **Day summary** - total covers booked, capacity percentage indicator
- **Booking list** - sorted by time, showing name, guests, time, dietary requirements
- **Edit button** per row - opens a modal to update booking details
- **Delete button** per row - requires confirmation before deleting
- **Settings tab/link** - navigate to tenant settings form

### Tenant Settings View

- Editable fields: name, max_guests, max_covers, block_current_day, concurrent_guests_time_limit
- **No delete option** (by design - as requested)
- Save button with validation feedback

---

## 6. Design Decisions (Confirmed)

### 🔑 Password Reset - ✅ Manual
No reset flow to build. If a venue owner forgets their password, it will be reset manually in the `AdminUsers` table. May revisit later with email integration.

### 👥 Multiple Staff Per Venue - ✅ One account per venue (for now)
Single `AdminUser` per tenant. Multi-user support is on the future roadmap but not in scope now. The DB schema already supports it when needed.

### 📋 Audit Trail - ✅ `modified_date` only
`modified_date` is sufficient for now. No `modified_by` field or audit log table needed at this stage.

### 📧 Customer Notification on Edit - ✅ Out of scope
Email notifications to customers when bookings are changed will be a separate piece of work. Flag for future - Cloudflare Email Workers + Mailchannels would handle this at no cost.

### 🖨️ Print / Export Day Sheet - ✅ Include
Print button included in the dashboard. Simple `window.print()` + print-optimised CSS. Included in Phase 4 (Dashboard UI).

### 🌍 Timezone
All dates/times are stored as plain strings (`YYYY-MM-DD`, `HH:MM`) - assumed to be the venue's local time. No server-side timezone handling needed. A note in the settings UI ("Times are in your local timezone") is sufficient.

### 📱 Mobile Responsiveness
Dashboard must be usable on mobile - venue owners will check bookings on their phones during service. Mobile-first is a design requirement, not a nice-to-have.

### 🔒 Rate Limiting on Login - ✅ Include
A D1-based login attempt tracker will lock an account after **10 failures within 15 minutes**. Implemented in the auth API (Phase 1). New migration needed: `login_attempts` tracking column on `AdminUsers` (or a separate table).

### 🚪 Session Expiry / Token Refresh
8-hour JWT expiry covers a full working day. On a `401` response the frontend redirects to `/admin/` with a "session expired" message.

---

## 7. Security Best Practices (Admin Dashboards Handling Customer Data)

| Practice | How We'll Apply It |
|----------|-------------------|
| **Tenant isolation** | JWT payload carries `tenant_id`; every query filters by it |
| **No credentials in source code** | `JWT_SECRET` stored as Wrangler secret, not in `wrangler.jsonc` |
| **Password hashing** | PBKDF2 with salt (Web Crypto API) - no plain-text passwords ever stored |
| **HTTPS only** | Cloudflare handles TLS termination |
| **Input validation** | Zod schemas on all admin endpoints (consistent with existing pattern) |
| **No cascading deletes via API** | Admin can delete a booking, but cannot delete their own tenant |
| **Confirmation on destructive actions** | UI confirmation modal before deleting any booking |
| **Principle of least privilege** | Admin users can only access their own tenant's data, nothing else |
| **Login rate limiting** | D1-based attempt counter - lock after 10 failures in 15 min |
| **Logging** | `console.error` on failures (already in existing routes) - Cloudflare Workers observability captures these |

---

## 8. Phased Delivery

| Phase | Work | Who | Notes |
|-------|------|-----|-------|
| **Phase 1** | DB migration (`AdminUsers` + login attempt tracking), auth API (`POST /api/auth/login` with rate limiting + JWT middleware), seed script | Sean | Backend foundation - blocks Phase 2 |
| **Phase 2** | Admin API routes (`/api/admin/me`, reservations CRUD) with tenant isolation | Sean | Can start once Phase 1 JWT middleware is done |
| **Phase 3** | Login UI (`/admin/index.html`) | Twinkie | Can start in parallel with Phase 2 |
| **Phase 4** | Dashboard UI - day view, booking list, date navigation, print button | Twinkie | Requires Phase 2 API |
| **Phase 5** | Edit booking modal + delete with confirmation | Twinkie | |
| **Phase 6** | Tenant settings UI | Twinkie | |
| **Phase 7** | Mobile responsive pass | Twinkie | |
| **Phase 8** | Tests - auth, rate limiting, tenant isolation, CRUD, session expiry | Neela | |

**Parallelism:** Phases 1+2 (backend) and Phase 3 (login UI shell) can run concurrently.

---

## 9. Decisions Log

| # | Question | Decision |
|---|----------|----------|
| 1 | Password reset | Manual DB reset for now. No reset flow to build. |
| 2 | Multiple staff per venue | One account per venue. Multi-user is future scope. |
| 3 | Audit trail | `modified_date` only. No `modified_by` needed now. |
| 4 | Rate limiting on login | ✅ Include - D1-based, lock after 10 failures in 15 min. |
| 5 | Print button | ✅ Include in Phase 4 dashboard. |
| 6 | Customer email on edit | Out of scope. Separate future piece of work. |
| 7 | Authentication approach | ✅ Custom JWT using Web Crypto API + Cloudflare Workers. |

---

## 10. What Is NOT Changing

- The existing public booking widget (`/public/index.html` etc.) - untouched
- Existing API routes (`/api/tenants`, `/api/reservations`) - untouched
- Existing DB schema (Tenants, Reservations) - only adding a new table
- Existing test suite - new tests will be added, nothing removed
