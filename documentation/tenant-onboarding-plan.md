# Tenant Onboarding Plan

## Recommendation

Use **Option B: a protected onboarding API endpoint** that creates the `Tenant` and first `AdminUser` in one atomic D1 `db.batch()` call, gated by `SUPER_ADMIN_KEY` stored as a Cloudflare Worker secret. Do **not** build a super-user dashboard yet. Do **not** keep the current `scripts/seed-admin.ts` path for production use.

For this stage, James needs a safe owner-only operation, not a product feature. Go-live has one client. A dashboard, super-user role model, audit UI, invitations, and user-management flows are more scope than the system needs today. A tiny authenticated HTTP operation gives us the important properties now: validation, prepared statements, one transaction, real password hashing, no SQL on the command line, and a clean path to a future UI.

Sean's backend findings file did not exist when this plan was written, so this recommendation is based on direct code reading. Current reality already supports part of Option B: `SUPER_ADMIN_KEY`, `superAdminAuth`, and protected tenant CRUD exist on `/api/tenants`. The missing piece is that tenant creation and first admin creation are separate and non-atomic.

## Real requirement

### Needed for first go-live client

- James can create one restaurant tenant safely.
- The tenant's first admin user is created at the same time.
- The operation is atomic: either both rows exist, or neither does.
- The operation reuses the same validation and password hashing code as the app.
- Secrets and passwords are not committed to the public repo and are not embedded in SQL strings.
- Production execution is intentional and hard to do accidentally.

### Not needed yet

- A self-service tenant onboarding dashboard.
- A persistent `super_admin` user role in `AdminUsers`.
- Tenant invitations, admin-user lifecycle management, password reset flows, billing, plans, or usage quotas.
- Multi-operator audit tooling beyond basic server logs.

The system is small. The right move is to secure the sharp edge, not turn onboarding into a product area prematurely.

## Security assessment of the status quo

`scripts/seed-admin.ts` should be treated as a production liability:

1. **Public operational playbook** — the script documents known production-looking tenant IDs and exact production execution commands in a public repo.
2. **Secrets on the command line / environment** — `ADMIN_PASSWORD` is supplied via shell environment examples. It can leak via shell history, terminal scrollback, process inspection, CI logs, or copied support snippets.
3. **SQL string interpolation** — the script builds raw SQL with `${tenantId}`, `${email}`, and `${passwordHash}`. A malformed email/password-derived value should never be able to change SQL shape; prepared statements should be mandatory.
4. **Shell command interpolation** — the raw SQL is embedded into `npx wrangler d1 execute --command "..."`; quoting mistakes become operational bugs.
5. **`--remote` foot-gun** — production is the default when `LOCAL !== 'true'`. A missed env var can affect remote data.
6. **Non-atomic onboarding** — James manually inserts a tenant first, then separately creates the admin. Failures leave half-created tenants or orphaned operational state.
7. **Duplicate password hashing** — the script reimplements `hashPassword` instead of importing `src/utils/auth.ts`, so future password-policy/hash changes can drift.
8. **No schema contract** — tenant insertion is manual SQL rather than `CreateTenantSchema`; admin creation currently has no creation schema.
9. **Poor auditability** — D1 execute from a local shell gives less controlled application-level logging than a named onboarding endpoint.

## Options

### Option A — hardened one-shot script / CLI

**Shape:** Replace `seed-admin.ts` with a local TypeScript tool that validates input, reads password without echo, imports `hashPassword`, uses prepared statements or calls an API, requires explicit `--remote --confirm-production`, and creates tenant + admin atomically.

**Security:** Much better than today if it avoids `wrangler d1 execute --command` and SQL interpolation. Still weaker than an API if it needs local database credentials/context and can be run from the wrong environment.

**Effort now:** Low to medium.

**Fit for one-client go-live:** Acceptable, but still an operator script in a public repo. It solves the immediate pain but keeps onboarding outside the app's trust-boundary patterns.

**Upgrade path:** Could later become a wrapper around an onboarding API. If it directly writes D1, some work is throwaway.

### Option B — protected onboarding API endpoint, no UI

**Shape:** Add `POST /api/admin/tenants` gated by `superAdminAuth` / `SUPER_ADMIN_KEY`. Payload contains tenant details and first admin email/password. The handler validates with Zod, hashes the password with `hashPassword`, and uses `db.batch()` with prepared statements to insert `Tenants` and `AdminUsers` atomically. James invokes it with curl/HTTPie or a tiny local helper that prompts for the password.

**Security:** Best near-term balance. Secret stays in Cloudflare Worker secrets, values are bound parameters, password hashing is DRY, and D1 batch gives transaction semantics. No public dashboard surface.

**Effort now:** Medium. Most pieces already exist: `superAdminAuth`, `SUPER_ADMIN_KEY`, `CreateTenantSchema`, `hashPassword`, and tenant CRUD tests.

**Fit for one-client go-live:** Strong. It is exactly one protected operational operation.

**Upgrade path:** Excellent. The same service function can later power a dashboard, invitations, or a real super-admin role without changing the core onboarding transaction.

### Option C — super-user role + dashboard

**Shape:** Add role/permission columns, seed James as a super-user, build dashboard UI for tenant creation, add navigation, forms, validation states, maybe admin-user management.

**Security:** Potentially strong eventually, but only if roles, sessions, audit, and UI flows are done properly. Half-building this is riskier than a small endpoint.

**Effort now:** High. Requires schema changes, migrations, frontend work, tests, and product decisions.

**Fit for one-client go-live:** Poor. This is multi-client operational tooling before the business has multi-client operational pressure.

**Upgrade path:** This is the later destination, not the first step.

## Answer to James: script or super-user dashboard?

A script is acceptable only as a thin local caller, not as the thing that writes production SQL. A super-user dashboard is not justified yet. The correct move now is a protected onboarding API endpoint with no UI. If James wants convenience, add a tiny local command that prompts for values and calls that endpoint; keep all real creation logic inside the Worker.

## Implementation plan

### 1. Sean — define the onboarding contract

- Add a Zod schema for the endpoint payload, e.g. `CreateTenantWithAdminSchema`:
  - `tenant`: reuse `CreateTenantSchema`.
  - `admin`: `{ email: z.email(), password: z.string().min(8) }`.
- Prefer a nested payload over flattening so tenant fields and admin fields cannot collide.
- Do not log raw request bodies or passwords.
- Return only safe output: tenant id/code/name and admin email. Never return `password_hash`.

### 2. Sean — implement the protected endpoint

- Add `POST /api/admin/tenants` protected by `superAdminAuth`, not tenant `adminAuth`.
- Register it before the `admin.use('*', adminAuth)` middleware if implemented inside `src/routes/admin.ts`, or create a separate router mounted explicitly in `src/app.ts`.
- Consider leaving existing protected `/api/tenants` CRUD in place for now, but deprecate direct tenant-only creation once tenant+admin onboarding exists.
- Use prepared statements only.

### 3. Sean — make tenant + admin creation atomic

- Generate `tenantId`, `adminUserId`, and `now` server-side.
- Hash via `hashPassword` from `src/utils/auth.ts`.
- Use `c.env.maximum_bookings_db.batch([...])` with two prepared statements:
  1. Insert `Tenants` including `concurrent_guests_time_limit`, `contact_email`, `created_date`, `modified_date`.
  2. Insert `AdminUsers` with the generated tenant id, email, hash, zero failed attempts, null lockout, timestamps.
- Rely on D1 `batch()` transaction semantics: statements execute sequentially and rollback the whole sequence if one fails.
- Map uniqueness failures to useful `409` responses for duplicate `tenant_code` or admin `email`.

### 4. Sean — retire the unsafe seed script

- Do not keep `scripts/seed-admin.ts` as a production D1 writer.
- Preferred: delete it and replace with documentation showing how to call the endpoint safely.
- Acceptable: replace it with `scripts/onboard-tenant.ts` that prompts locally and calls `POST /api/admin/tenants`; it must not build SQL or shell out to `wrangler d1 execute`.
- If a local helper is kept, require an explicit target URL and never default to production.

### 5. Sean — manage the super-admin secret correctly

- Store `SUPER_ADMIN_KEY` with `npx wrangler secret put SUPER_ADMIN_KEY` for production.
- Keep local values only in `.env` or `.dev.vars`, never committed.
- Generate a high-entropy random value; treat it like an API key.
- Rotate by running `wrangler secret put SUPER_ADMIN_KEY` again and updating James's local password manager entry.
- Use header `X-Admin-Key` short-term because it already exists; longer-term can move to `Authorization: Bearer` if desired.

### 6. Neela — add backend tests

- `POST /api/admin/tenants` returns 401 without/with wrong `X-Admin-Key`.
- Valid request creates exactly one `Tenants` row and one `AdminUsers` row.
- Created admin can log in via `POST /api/auth/login` with the submitted password.
- Duplicate `tenant_code` fails with 409 and creates no admin.
- Duplicate admin email fails with 409 and creates no tenant.
- Invalid tenant payload fails with 400 and creates nothing.
- Invalid admin password/email fails with 400 and creates nothing.
- Response never includes `password_hash`.

### 7. Twinkie — no UI work now

- No dashboard UI for this phase.
- If James wants ergonomics, Twinkie is not needed; use a local CLI wrapper or documented HTTPie command.

### 8. Documentation updates

- Update `documentation/DATA_MODEL.md` only if schema changes are introduced. If no new columns are added, add a short note under `AdminUser` or relationships that first-admin creation is performed atomically with tenant onboarding.
- Update `BUSINESS_LOGIC.md` with an operational note that tenant onboarding is `POST /api/admin/tenants`, protected by `SUPER_ADMIN_KEY`, and creates tenant + first admin together.
- Add an operator runbook in `documentation/` showing:
  - how to set/rotate `SUPER_ADMIN_KEY`;
  - how to call the endpoint without placing the admin password in shell history;
  - how to verify login;
  - how to recover if a request fails.

## Minimum endpoint shape

```http
POST /api/admin/tenants
X-Admin-Key: <SUPER_ADMIN_KEY>
Content-Type: application/json
```

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
    "password": "prompted-not-hardcoded"
  }
}
```

## Decision

Choose Option B now. It removes the insecure workflow, fits the one-client go-live constraint, and creates the same backend primitive that a future super-admin dashboard will use. Option A is only acceptable as a wrapper around Option B. Option C waits until there are enough tenants to justify operational UI and role complexity.
