# CSV Booking Migration Runbook

A step-by-step guide for migrating live customer bookings from a third-party system
(e.g. Dojo, ResDiary, OpenTable) into Maximum Bookings from a CSV export, and notifying
those customers with a working "Manage my booking" link.

This runbook generalises the process we followed for the **Red Cow / Dojo** migration.
For the concrete column analysis of that specific file, see
[`dojo-data-migration.md`](dojo-data-migration.md).

---

## Overview

The migration has three phases:

1. **Import** — map CSV columns to the `Reservations` schema and insert the rows.
2. **Backfill tokens** — generate a `manage_token_hash` for each imported row so the
   customer-facing manage/cancel links validate.
3. **Notify** — email each customer a migration notice containing their new manage link.

> **The schema is the source of truth.** The CSV bends to fit the schema, never the other
> way around. Columns with no match or translation are ignored (but documented).

**Golden rules**
- ⚠️ **Never send before backfilling.** Links validate against `manage_token_hash`; if the
  hash isn't set on prod, every link is dead.
- ⚠️ **Confirm `JWT_SECRET` parity** between your local `.env` and the production Worker
  before generating any tokens (see Phase 2). Mismatched secrets = dead links.
- ⚠️ **Dry-run everything** against production before writing or sending.
- ✅ Prefer running production `INSERT`/`UPDATE` yourself via `wrangler ... --remote`; use
  the scripts to *generate* SQL and *send* email, not to silently mutate prod.

---

## Prerequisites

- The CSV export from the old system.
- Access to the target D1 database (`maximum_bookings_db`) via `wrangler`.
- A local `.env` at the repo root containing:
  - `JWT_SECRET` — must match the production Worker's secret.
  - `RESEND_API_KEY` — for sending email.
  - `PUBLIC_URL` — the public site URL (used in links); can be overridden with `--base-url`.
- The target **tenant's** `id`, `name`, and `contact_email` (the `from`/reply-to address).
  The sending domain must be **verified in Resend** or sends will fail.
- `node` + `npx tsx` available (already a dev dependency).

---

## Reference: the `Reservations` schema

Target columns (`db/schema.sql`):

```
id, tenant_id, first_name, surname, telephone, email,
reservation_date, reservation_time, guests, dietary_requirements,
created_date, modified_date, manage_token_hash
```

Key facts that shape the migration:
- `id` is a UUID string — generate one per row.
- `tenant_id` is a required FK to `Tenants(id)` — the tenant must already exist.
- `reservation_date` = `YYYY-MM-DD`, `reservation_time` = `HH:MM` (naive local time, no TZ).
- `guests` has **no** CHECK constraint — bookings above `max_covers`/`max_guests` are allowed
  via SQL/admin (those limits are UI-only guards). Large parties import fine.
- There are **no triggers** and pure SQL **never sends email** — inserts are side-effect free.
- Unique index `idx_reservations_unique_booking` on
  `(tenant_id, email, reservation_date, reservation_time)` — use `INSERT OR IGNORE` to be safe.
- `manage_token_hash` may be `NULL` on import; the link won't work until backfilled (Phase 2).

---

## Phase 1 — Import

### 1.1 Analyse the CSV columns

Inspect headers, row count, distinct values, and data-quality edge cases:

```powershell
$data = Import-Csv ".\your-export.csv"
"Rows: $($data.Count)"
$data | Get-Member -MemberType NoteProperty | Select-Object Name
# Spot-check tricky fields:
($data | Where-Object { $_.'<Email column>' -eq '' }).Count      # empty emails
($data | Where-Object { ($_.'<Name column>'.Trim() -split '\s+').Count -ne 2 }).Count  # non "First Last"
```

Classify **every** column into one of:

| Bucket | Meaning |
|---|---|
| **Direct match** | Copy as-is into a schema column (e.g. email → `email`). |
| **Translate** | Transform then map (split name, split datetime, strip characters). |
| **Generated** | No CSV source; created during import (`id`, `tenant_id`, timestamps, `manage_token_hash`). |
| **Ignored** | No schema home — dropped, but **documented** so the loss is intentional. |

Document the mapping in a per-source file like `dojo-data-migration.md`.

### 1.2 Common translations (learned from Dojo)

- **Name → `first_name` + `surname`**: split on first whitespace (`"First Last"` → two tokens;
  extra tokens go to surname). Check for single-word or 3+ word names first.
- **Phone → `telephone`**: exports often prefix numbers with a `'` text-guard (Excel).
  **Strip a leading apostrophe.** Confirm it matches `^\+?[\d\s\-]{7,15}$`.
- **Datetime → `reservation_date` + `reservation_time`**: split `YYYY-MM-DD HH:MM:SS`.
  Take **local wall-clock** time. If the export has both a UTC and a local column, use the
  **local** one. Verify each date's DST offset (see Phase 1.3).
- **Notes/comments → `dietary_requirements`**: the only free-text column. A loose fit, but
  no data is lost. Empty → `NULL`.
- **Status/deposit/reference columns**: usually **ignored** (no schema equivalent). A status
  like `booked` can be used as an **import filter** rather than stored.

### 1.3 Timezone check (naive time)

The system stores naive local time. If the export provides UTC, confirm whether each booking
falls in BST or GMT and convert to local wall-clock:

```powershell
# BST 2026 window example: 29 Mar 2026 → 25 Oct 2026 (UTC+1). Outside = GMT (UTC+0).
$bstStart = Get-Date '2026-03-29'; $bstEnd = Get-Date '2026-10-25'
foreach ($r in $data) {
  $d = [datetime]::ParseExact($r.'<Local time column>', 'yyyy-MM-dd HH:mm:ss', $null)
  "{0} BST={1}" -f $d, ($d -ge $bstStart -and $d -lt $bstEnd)
}
```

Note the assumption in your generated SQL as a comment.

### 1.4 Generate the INSERT

Transform each row and emit one `INSERT OR IGNORE`. Per row:
- `id` = new UUID (`[guid]::NewGuid()` / `crypto.randomUUID()`)
- `tenant_id` = the target tenant's id
- SQL-escape strings (double any `'`)
- `manage_token_hash` = `NULL` (set in Phase 2)
- omit `created_date` / `modified_date` to use the schema defaults (`CURRENT_TIMESTAMP`)

```sql
INSERT OR IGNORE INTO Reservations
  (id, tenant_id, first_name, surname, telephone, email,
   reservation_date, reservation_time, guests, dietary_requirements, manage_token_hash)
VALUES
  ('<uuid>', '<tenant_id>', 'First', 'Last', '+447...', 'a@b.com',
   '2026-07-10', '17:00', 4, NULL, NULL),
  ... ;
```

### 1.5 Dry-run locally, then apply to prod

Test against the **local** D1 first (note: local seed data may inflate counts — verify by the
specific IDs you inserted):

```powershell
npx wrangler d1 execute maximum_bookings_db --local  --file="db\your-insert.sql"
npx wrangler d1 execute maximum_bookings_db --remote --file="db\your-insert.sql"
```

⚠️ **Local vs prod tenant ids differ.** The same tenant often has a different `id` locally
than in production. Use the correct id for each environment.

Verify the count and spot-check a couple of rows after each run.

---

## Phase 2 — Backfill manage tokens

### How the token works

```
token = HMAC_SHA256(JWT_SECRET, "manage:{reservationId}:{lowercased-email}")   // hex
hash  = SHA256(token)                                                          // stored in DB
```

The link carries the **plaintext token**; the DB stores only the **hash**. Validation
re-derives the token from `(JWT_SECRET, id, email)` and compares hashes. This is implemented in
`src/utils/manageToken.ts` — the migration scripts reproduce it exactly with Node's `crypto`.

### 2.1 Export the prod rows

Because imported rows are identified by `manage_token_hash IS NULL`, export the real prod rows
(the CSV row order/UUIDs may differ from your local insert file). Filter by the customer emails:

```sql
SELECT id, first_name, surname, email, reservation_date, reservation_time, guests,
       CASE WHEN manage_token_hash IS NULL THEN 'NEEDS TOKEN' ELSE 'has token' END AS token_status
FROM Reservations
WHERE tenant_id = '<tenant_id>'
  AND email IN ('a@b.com', 'c@d.com', ...)
ORDER BY reservation_date, reservation_time;
```

Save the result as `export.csv` at the repo root — this becomes the **ground truth** for
tokens and sending (no further prod reads needed). Confirm the row count matches expectations.

### 2.2 Parity check (do this before anything irreversible)

Prove your local `JWT_SECRET` matches production by backfilling **one** row and clicking its
live link:

```powershell
npx tsx scripts/prepare-migration-from-csv.ts --parity <reservationId> `
  --base-url https://<your-worker>.workers.dev
```

Run the printed `UPDATE` on prod, then click the printed link:
- ✅ Page loads the booking → secret matches. Proceed.
- ❌ Invalid/unauthorised → **stop**. Resolve the secret mismatch first (all links would be dead).

### 2.3 Generate and apply the full backfill

Generate one `UPDATE` per row into `db/prod-migration-backfill.sql`:

```powershell
npx tsx scripts/prepare-migration-from-csv.ts --base-url https://<your-worker>.workers.dev
```

Apply to prod and confirm zero remain `NULL`:

```powershell
npx wrangler d1 execute maximum_bookings_db --remote --file="db\prod-migration-backfill.sql"

npx wrangler d1 execute maximum_bookings_db --remote --command "SELECT COUNT(*) AS still_null FROM Reservations WHERE tenant_id='<tenant_id>' AND email IN ('a@b.com',...) AND manage_token_hash IS NULL;"
# expect: still_null = 0
```

Backfill is **deterministic and idempotent** — safe to re-run.

---

## Phase 3 — Notify customers

### 3.1 The email template

`src/emails/customer-migration.ts` (`buildCustomerMigrationEmail`) reuses the house style from
`customer-amendment.ts` (`emailWrapper`, `detailsTable`, teal button) and the existing
`CustomerReservationEmailData` type — no schema/type changes. It reassures the customer their
booking is unchanged and provides the new manage link.

To adapt the copy, edit that file. To preview one rendered email without sending:

```powershell
npx tsx scripts/send-migration-emails.ts --preview --local --id <reservationId> `
  --tenant <local_tenant_id>
# writes migration-email-preview.html (open in a browser)
```

### 3.2 Test send (to yourself)

Send exactly one real email to your own address before the bulk run:

```powershell
npx tsx scripts/send-migration-emails.ts --test "you@example.com" --local `
  --id <reservationId> --tenant <local_tenant_id>
```

Check: rendering, the `from` address, and that the manage link loads.

### 3.3 Bulk dry-run, then send

Always dry-run first — it lists every recipient and link but sends nothing:

```powershell
npx tsx scripts/prepare-migration-from-csv.ts --send --dry-run `
  --base-url https://<your-worker>.workers.dev
```

Review the list, then send for real:

```powershell
npx tsx scripts/prepare-migration-from-csv.ts --send `
  --base-url https://<your-worker>.workers.dev
```

- Emails send **from** the tenant's `contact_email` (must be Resend-verified).
- Use `--only <email>` to restrict a send to a single recipient as an extra safeguard.
- ⚠️ These reach **real customers** and cannot be undone. Get explicit sign-off first.

---

## Tooling summary

| File | Purpose |
|---|---|
| `src/emails/customer-migration.ts` | Migration email template (house style). |
| `scripts/prepare-migration-from-csv.ts` | CSV-driven (no prod reads): `--parity`, backfill-SQL generation (default), `--send [--dry-run] [--only]`. Reads `export.csv` + original CSV (for notes). |
| `scripts/send-migration-emails.ts` | D1-driven runner: `--preview`, `--test`, `--backfill`, `--send`, `--verify`. Handy for local preview/test. |
| `db/prod-migration-backfill.sql` | Generated `UPDATE`s that set `manage_token_hash` on prod. |
| `export.csv` | Ground-truth prod rows exported in Phase 2.1. |

> **Note:** `scripts/send-migration-emails.ts` had an unreliable `--remote` read path during
> the Red Cow migration (returned a single row instead of the full set), which is why the
> CSV-driven `prepare-migration-from-csv.ts` is preferred for production. Use the D1 runner for
> local preview/test only, or fix its remote read before relying on it for prod.

---

## Post-migration cleanup

- `db/prod-migration-backfill.sql`, `export.csv`, and `migration-email-preview.html` are
  booking-specific local artifacts. The preview HTML and the send-ledger
  (`scripts/.migration-sent-*.json`) are already git-ignored. Delete the backfill SQL / export
  once the migration is verified, or keep them out of version control.
- Re-running `--send` is guarded by a local ledger (`scripts/.migration-sent-*.json`) in the
  D1 runner; the CSV sender has no ledger, so use `--dry-run` and `--only` to avoid duplicates.

---

## Quick checklist

- [ ] CSV columns classified (match / translate / generated / ignored) and documented
- [ ] Names split, phones de-guarded, datetimes split to local time, TZ verified
- [ ] `INSERT OR IGNORE` generated; tested local; applied to prod; counts verified
- [ ] Prod rows exported to `export.csv`; row count confirmed
- [ ] **Parity check passed** (one row backfilled + live link clicks through)
- [ ] Full backfill applied to prod; `still_null = 0`
- [ ] Email template reviewed; test email to self looks right
- [ ] Bulk **dry-run** reviewed
- [ ] Sign-off obtained → real send → delivery confirmed
- [ ] Local artifacts cleaned up
