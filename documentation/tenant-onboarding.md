# Tenant Onboarding Guide

This guide covers everything needed to bring a new tenant live on Maximum Bookings. Follow the steps in order.

---

## Prerequisites

- Access to the Cloudflare dashboard for the `maximum-bookings` Worker
- `npx wrangler` available locally (already in project `devDependencies`)
- The tenant's domain, venue name, contact email, and capacity preferences confirmed in advance

---

## Step 1 — Set the Resend API Key

Email (booking confirmations, amendments, cancellations) is sent via [Resend](https://resend.com). The API key is a **Worker Secret** stored in Cloudflare — it is shared across all tenants on the platform.

### Production

```powershell
npx wrangler secret put RESEND_API_KEY
# Paste the key when prompted (format: re_xxxxxxxx...)
```

The key is already set in production if the platform is live. You only need to rotate it when the key changes.

### Local development

Add it to `.dev.vars` in the repo root (this file is git-ignored):

```
RESEND_API_KEY=re_xxxxxxxx...
JWT_SECRET=<your-local-secret>
```

> **Note:** `.dev.vars` is the local equivalent of Wrangler secrets. Never commit it.

---

## Step 2 — Verify the Tenant's Domain in Resend and Set `contact_email`

Every tenant has a `contact_email` stored in the `Tenants` table. This address is used as **both**:

- The `from` address on all emails sent to customers (`"Venue Name" <contact_email>`)
- The `to` address for internal booking notification emails sent to the tenant

This means **the domain of `contact_email` must be verified in Resend**, or email delivery will fail.

### 2a — Verify the domain in Resend

1. Log in to [resend.com](https://resend.com) → **Domains** → **Add Domain**
2. Enter the tenant's domain (e.g. `redcownantwich.co.uk`)
3. Resend will provide DNS records (TXT + MX/DMARC). Add these to the domain's DNS
4. Click **Verify** once DNS has propagated (can take up to 48 hours, usually minutes)

### 2b — Ensure `contact_email` is on the verified domain

The `contact_email` you set for the tenant **must use the verified domain**. For example, if you verify `redcownantwich.co.uk`, the `contact_email` must be `something@redcownantwich.co.uk`.

> If the domain is not verified, Resend will reject the send silently. Bookings will still be created in the database — emails just won't arrive. The Worker logs the error but does not block the booking.

---

## Step 3 — Create the Tenant Record in D1

If this is a brand new tenant (not already seeded), insert them into the `Tenants` table.

### Required fields

| Field | Description |
|---|---|
| `name` | Display name (e.g. `The Red Cow`) |
| `tenant_code` | URL slug — lowercase alphanumeric + hyphens, e.g. `redcow`. Used in the booking widget embed URL |
| `max_guests` | Maximum concurrent guests within the `concurrent_guests_time_limit` window. Set to `0` for unlimited |
| `max_covers` | Maximum total covers per day. Set to `0` for unlimited |
| `status` | `active` or `cancelled` |
| `concurrent_guests_time_limit` | Overlap window in minutes (default `120`) |
| `contact_email` | Must be on a Resend-verified domain (see Step 2) |

### Insert via Wrangler

```powershell
# Production
npx wrangler d1 execute maximum_bookings_db --command "INSERT INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit, contact_email) VALUES ('$(New-Guid)', 'The Red Cow', 'redcow', 6, 50, 'active', 120, 'info@redcownantwich.co.uk');"

# Local
npx wrangler d1 execute maximum_bookings_db --local --command "INSERT INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit, contact_email) VALUES (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(6))), 'The Red Cow', 'redcow', 6, 50, 'active', 120, 'info@redcownantwich.co.uk');"
```

> Use a proper UUID generator rather than SQLite's `randomblob` in production. PowerShell's `New-Guid` works well, or copy any UUID generator output.

### Retrieve the tenant's UUID (you'll need it for Step 4)

```powershell
npx wrangler d1 execute maximum_bookings_db --command "SELECT id, name, tenant_code FROM Tenants WHERE tenant_code = 'redcow';"
```

---

## Step 4 — Create an Admin User for the Tenant

Each tenant gets one or more `AdminUsers` row. The user logs in at `/admin/` with their email and a password you supply to them.

There is a dedicated script for this: `scripts/seed-admin.ts`.

### Usage (PowerShell)

**Production:**
```powershell
$env:TENANT_ID="<tenant-uuid-from-step-3>"
$env:ADMIN_EMAIL="owner@theirrestaurant.co.uk"
$env:ADMIN_PASSWORD="<strong-temporary-password>"
npx tsx scripts/seed-admin.ts
```

**Local dev:**
```powershell
$env:TENANT_ID="<tenant-uuid-from-step-3>"
$env:ADMIN_EMAIL="owner@theirrestaurant.co.uk"
$env:ADMIN_PASSWORD="<strong-temporary-password>"
$env:LOCAL="true"
npx tsx scripts/seed-admin.ts
```

The script will:
1. Hash the password using PBKDF2-SHA256 (100,000 iterations) — the same algorithm the login route uses
2. Insert the row into `AdminUsers` via `wrangler d1 execute`
3. Print a confirmation message on success

### Credentials to send to the tenant

After running the script, give the tenant:

- **Login URL:** `https://<worker-domain>/admin/`
- **Email:** whatever you set as `ADMIN_EMAIL`
- **Temporary password:** whatever you set as `ADMIN_PASSWORD`

> Advise them to use a password manager and treat this as a temporary credential. There is currently no self-service password reset — to change a password, run the script again with a new value (it will insert an additional user row; delete the old one manually if needed, or update `password_hash` directly via D1).

### Account lockout

After 10 consecutive failed login attempts, the account is locked for 15 minutes. A successful login resets the counter.

### JWT session length

Sessions are JWT-based (HS256), valid for **8 hours** from login. There is no refresh mechanism — the tenant will need to log in again after the token expires.

---

## Step 5 — Configure Opening Hours

By default, if no `OpeningHours` rows exist for a tenant, the booking widget treats all days as open with slots from **12:00 to 21:30** (last slot at 21:30; `22:00` is the exclusive upper bound).

If the tenant has non-standard hours, configure them via the admin dashboard under **Settings → Opening Hours** after they log in, or insert them directly via D1.

---

## Step 6 — Embed the Booking Widget

The booking widget is a standalone Preact bundle embedded in the tenant's website via a single `<script>` tag pointing at the deployed Worker's asset URL.

The widget identifies the tenant by `tenant_code` via a URL parameter or data attribute — refer to the existing embeds (e.g. `redcow`) for the exact embed pattern.

The tenant's `tenant_code` (e.g. `redcow`) is what their embed script references.

---

## Step 7 — Run Migrations (first deploy only)

If this is a fresh environment (new D1 database), run migrations before anything else:

```powershell
# Production
npx wrangler d1 migrations apply maximum_bookings_db

# Local
npx wrangler d1 migrations apply maximum_bookings_db --local
```

Migrations are in `./migrations/` and are idempotent — safe to re-run.

---

## Checklist Summary

| # | Task | Done? |
|---|---|---|
| 1 | `RESEND_API_KEY` secret set in Wrangler (production) | ☐ |
| 2 | Tenant domain verified in Resend | ☐ |
| 3 | `contact_email` is on the verified domain | ☐ |
| 4 | Tenant row inserted into D1 (`Tenants` table) | ☐ |
| 5 | Tenant UUID retrieved | ☐ |
| 6 | Admin user created via `scripts/seed-admin.ts` | ☐ |
| 7 | Login credentials sent to tenant | ☐ |
| 8 | Tenant has configured opening hours in the dashboard | ☐ |
| 9 | Booking widget embed tested end-to-end | ☐ |

---

## Reference: Known Tenant IDs (Production)

| Tenant | `tenant_code` | UUID |
|---|---|---|
| The Red Cow | `redcow` | `6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d` |
| The Crown & Anchor | `crownandanchor` | `59986b7d-a829-4315-9b49-f643ec83cf47` |
| The Oak Tavern | `oaktavern` | `bac4bf8d-f05a-47b8-aab9-f1dc3710fb72` |

---

## Reference: Secrets Required by the Worker

Both secrets must be set via `npx wrangler secret put <NAME>` for production, and in `.dev.vars` for local dev.

| Secret | Purpose |
|---|---|
| `JWT_SECRET` | Signs and verifies admin session JWTs. Generate a strong random string (32+ chars) |
| `RESEND_API_KEY` | Authenticates against the Resend API for email delivery. Format: `re_xxxxxxxx...` |

Neither secret is stored in `wrangler.jsonc` (by design — secrets must not be committed to source control).
