# Tenant onboarding backend findings

## Current admin auth model

- App wiring: `src/app.ts:31-37` mounts public tenants/reservations, `POST /api/auth/login`, and authenticated admin routes under `/api/admin`, `/api/admin/blocked-dates`, and `/api/admin/opening-hours`.
- Login uses `LoginSchema`, fetches `AdminUsers` by globally unique `email`, verifies the stored password hash, resets/increments lockout fields, fetches the user's tenant, then signs a JWT containing `{ userId, tenantId }` (`src/routes/auth.ts:9-66`).
- Password verification/signing lives in `src/utils/auth.ts`: PBKDF2/SHA-256, 100,000 iterations, 16-byte random salt, stored as `saltHex:hashHex`; JWTs are HS256 HMAC with default 8-hour expiry (`src/utils/auth.ts:31-65`).
- Admin route auth reads `Authorization: Bearer <token>`, verifies with `c.env.JWT_SECRET`, and puts `userId`/`tenantId` into Hono context (`src/middleware/adminAuth.ts:4-16`). `JWT_SECRET` is a Workers secret typed in `src/types/env.d.ts:5-8` and documented in `wrangler.jsonc:39-47`.
- The JWT is tenant-scoped because `tenantId` is included and all admin data routes read `c.get('tenantId')` (`src/routes/admin.ts:25-30`, `src/routes/opening-hours.ts:16-22`, `src/routes/blocked-dates.ts:16-41`).
- There is no role/permission model on `AdminUsers`: the SQL table has `id`, `tenant_id`, `email`, `password_hash`, lockout/date columns only (`db/schema.sql:40-50`), Zod matches that (`src/schema/index.ts:139-148`), and `JwtPayload` only includes `userId` and `tenantId` (`src/types/index.ts:68`). Every valid admin JWT is equal within its tenant.
- Separate super-admin protection already exists, but it is not an `AdminUser`: `superAdminAuth` compares `X-Admin-Key` with `c.env.SUPER_ADMIN_KEY` using `timingSafeEqual` (`src/middleware/superAdminAuth.ts:4-13`).

## `scripts/seed-admin.ts` risks

- Hardcoded real-looking tenant IDs and a personal email appear in repo comments/examples (`scripts/seed-admin.ts:4-13`). That leaks operational identifiers and encourages copy/paste production use.
- Password is supplied via `ADMIN_PASSWORD` in shell environment examples (`scripts/seed-admin.ts:9-13`, `18-20`). This can leak through shell history, process inspection, terminal logs, and CI logs.
- SQL is built by interpolating `tenantId`, `email`, and `passwordHash` directly into an `INSERT` string (`scripts/seed-admin.ts:47`). A quote in email/tenant input can break the SQL; malicious input can inject SQL. The command is then interpolated into a shell string (`scripts/seed-admin.ts:49-50`), adding command-line quoting risk.
- The script shells out to `npx wrangler d1 execute ... --command "${sql}"` (`scripts/seed-admin.ts:49-53`) instead of using prepared statements/bindings. This violates the app's normal D1 prepared-statement pattern.
- Default mode is remote production-like execution: `LOCAL=true` is required to choose `--local`; otherwise it uses `--remote` (`scripts/seed-admin.ts:21`, `49`). A missing flag can hit the remote DB.
- No tenant existence check before insert. It relies on the FK only if D1 foreign keys are enforced for that execution path (`scripts/seed-admin.ts:47`; FK defined at `db/schema.sql:49`).
- No friendly uniqueness handling for the globally unique admin email (`db/schema.sql:85`); any duplicate fails as a raw wrangler/script error (`scripts/seed-admin.ts:52-58`).
- It duplicates the production password hashing implementation instead of importing/reusing `src/utils/auth.ts` (`scripts/seed-admin.ts:28-40` vs `src/utils/auth.ts:31-38`). Any future hash change can silently diverge.
- It only creates `AdminUsers`; tenant creation remains a separate manual insert, so tenant/admin can drift or be partially completed (`scripts/seed-admin.ts:47`).

## Tenant + AdminUser data model

- `Tenants`: `id`, `name`, `tenant_code`, `max_guests`, `max_covers`, `status`, `concurrent_guests_time_limit`, `contact_email`, dates (`db/schema.sql:3-14`). `tenant_code` has a unique index (`db/schema.sql:84`; migration `migrations/0008_tenant_code_unique_index.sql:6-7`).
- Tenant validation requires `tenant_code` lowercase alphanumeric/hyphens, non-negative capacity fields, `status` active/cancelled, positive/defaulted `concurrent_guests_time_limit`, and valid `contact_email` (`src/schema/index.ts:3-18`).
- `AdminUsers`: `tenant_id` FK cascades to `Tenants`, globally unique `email`, `password_hash`, `failed_attempts`, `locked_until`, dates (`db/schema.sql:40-50`, `82`, `85`; migration `migrations/0002_admin_users.sql:1-14`).
- `OpeningHours`: one row per `(tenant_id, day_of_week)` with `day_of_week` 0-6, `is_closed`, optional `open_time`/`close_time`, unique `(tenant_id, day_of_week)`, FK cascade (`db/schema.sql:67-76`; migration `migrations/0005_opening_hours.sql:1-10`). API validation requires exactly 7 unique weekdays on upsert (`src/schema/index.ts:115-135`).
- `BlockedDates` is optional closure data; no rows are needed for a new tenant unless there are closures/partial blocks (`db/schema.sql:54-63`, `src/routes/blocked-dates.ts:46-73`).
- Opening hours are not currently database-required for bookings to work: public tenant lookup returns `opening_hours: null` if no rows exist (`src/routes/tenants.ts:27-35`), blocked-times falls back to generated default slots if no opening-hours row exists (`src/routes/availability.ts:96-111`), and booking creation only enforces opening hours when a row exists (`src/routes/reservations.ts:139-162`). For a fully configured tenant, still insert all 7 rows so the widget/admin reflect real trading hours.

### Minimum inserts to create a working tenant

1. Insert one `Tenants` row with UUID `id`, unique `tenant_code`, `name`, `status='active'`, sensible `max_guests`, `max_covers`, `concurrent_guests_time_limit` (or DB default 120), non-empty valid `contact_email`, and timestamps.
2. Insert one `AdminUsers` row with UUID `id`, matching `tenant_id`, unique admin `email`, `password_hash` in `saltHex:hashHex` PBKDF2 format, and timestamps. Lockout fields can use DB defaults/null.
3. Insert 7 `OpeningHours` rows, one per `day_of_week` 0-6. Closed days should use `is_closed=1` and null times; open days should use `is_closed=0` with `HH:MM` open/close.
4. Insert zero `BlockedDates` rows initially unless the venue has known closures.

## Existing tenant-management prior art

- There is already a super-admin tenant route: `GET /api/tenants`, `POST /api/tenants`, `PATCH /api/tenants/:id`, `DELETE /api/tenants/:id` all use `superAdminAuth` except public `GET /api/tenants/:id` (`src/routes/tenants.ts:8-119`).
- Existing `POST /api/tenants` creates only the tenant; it does not create an admin user or opening hours (`src/routes/tenants.ts:39-68`).
- Current `POST /api/tenants` validates a `CreateTenantSchema` that includes `contact_email` and `concurrent_guests_time_limit` (`src/schema/index.ts:3-24`), but the insert only writes `id, name, tenant_code, max_guests, max_covers, status, created_date, modified_date` (`src/routes/tenants.ts:52-58`). That means supplied `contact_email` and `concurrent_guests_time_limit` are ignored and DB defaults are used.
- Existing tenant routes already use prepared statements and uniqueness handling for `tenant_code` (`src/routes/tenants.ts:51-65`, `90-104`), so they are a natural extension point for atomic tenant+admin onboarding.

## Options feasibility: backend facts only

### A. Hardened CLI creates tenant+admin together

- Feasible if it avoids shell-interpolated SQL and reuses app hashing (`src/utils/auth.ts:31-38`). A CLI that continues to use `wrangler d1 execute --command` inherits the current injection/quoting risks because D1 CLI command strings are not bound prepared statements (`scripts/seed-admin.ts:47-53`).
- A safe implementation needs one code path for hash generation, explicit local/remote targeting, tenant-code/email uniqueness handling, and all inserts performed atomically.

### B. Protected `POST /api/admin/tenants` or equivalent using super-user secret, no UI

- Backend support already exists conceptually: `SUPER_ADMIN_KEY` in Workers env, `X-Admin-Key` middleware, and protected tenant routes (`src/middleware/superAdminAuth.ts:4-13`; `src/routes/tenants.ts:8-119`).
- This can extend the current route surface to accept tenant + initial admin + 7 opening-hours rows in one request, using prepared statements and returning the app's `{ success, data?, error? }` shape.
- No new auth table/role is required; the super-user credential remains a Workers secret (`wrangler.jsonc:39-47`, `src/types/env.d.ts:5-8`).

### C. Super-user role on `AdminUser` + dashboard area

- Not currently supported by schema, JWT, or middleware. It would require a new migration adding a role/scope column, Zod updates, JWT payload changes, middleware authorization changes, and UI/dashboard work (`db/schema.sql:40-50`; `src/schema/index.ts:139-148`; `src/types/index.ts:68`; `src/middleware/adminAuth.ts:4-16`).
- This is feasible but larger than a one-client launch path because today's `AdminUsers.email` is global and every admin JWT is tenant-scoped/equal.

## Atomicity: use `db.batch()`

- Cloudflare D1's Worker API supports `D1Database.batch([...preparedStatements])`. The current docs state batched statements are SQL transactions: statements execute sequentially, and if one fails the sequence aborts/rolls back. Source: <https://developers.cloudflare.com/d1/worker-api/d1-database/#batch>.
- This is already used in the codebase for opening-hours replacement (`src/routes/opening-hours.ts:54-70`). A tenant onboarding endpoint should batch prepared inserts for `Tenants`, `AdminUsers`, and `OpeningHours` so partial onboarding cannot persist.
