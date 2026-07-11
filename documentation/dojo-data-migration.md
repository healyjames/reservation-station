# Dojo Data Migration — Red Cow.csv

> Plan for importing live customer booking data exported from **Dojo** (`Red Cow.csv`)
> into the `Reservations` table.
>
> Sources compared: [`db/schema.sql`](../db/schema.sql), [`BUSINESS_LOGIC.md`](../BUSINESS_LOGIC.md), [`DATA_MODEL.md`](DATA_MODEL.md).

## 1. Source file overview

- **File:** `Red Cow.csv`
- **Rows:** 14 bookings (+ 1 header row)
- **Date range:** 2026-07-10 → 2026-10-02
- **Data quality:** clean. Every row has an email, mobile, party size and a unique booking reference. No empty required values.
- Every booking is `Fulfilment Type = booked`, `Has Deposit = No`, `Has Preauth = No`.

Target table `Reservations` (from `db/schema.sql`):

```
id, tenant_id, first_name, surname, telephone, email,
reservation_date, reservation_time, guests, dietary_requirements,
created_date, modified_date, manage_token_hash
```

## 2. Column-by-column mapping

| CSV column | Target column | Status | Notes |
|---|---|---|---|
| `Parties Booking Name` | `first_name` + `surname` | **Translate (split)** | Single "First Last" field. Split on whitespace → `first_name` = first token, `surname` = remainder. All 14 rows are exactly 2 words, so this is clean here. |
| `Parties Booking Email` | `email` | **Direct match** | Use as-is. Feeds the unique index `idx_reservations_unique_booking` and `manage_token_hash`. |
| `Users User Mobile Number` | `telephone` | **Translate (clean)** | Values are prefixed with a literal apostrophe as an Excel text guard, e.g. `'+447974086566`. **Strip the leading `'`** before insert. Result matches the DB regex `^\+?[\d\s\-]{7,15}$`. |
| `Parties Party Size` | `guests` | **Direct match** | Integer. Cast from text. Range in file: 2–7. |
| `Booking Time (BST)` | `reservation_date` + `reservation_time` | **Translate (split) — USE THIS COLUMN** | Local wall-clock time. Split the datetime: date → `reservation_date` (`YYYY-MM-DD`), time → `reservation_time` (`HH:MM`). See §3 for why this column and not `Parties Booking Time`. |
| `Parties Comments Consumer` | `dietary_requirements` | **Translate (closest fit)** | Free-text customer notes (4 of 14 populated, e.g. "We Will Have The Dog With Us"). No dedicated notes column exists, so map into `dietary_requirements`. NULL/empty → NULL. ⚠️ Semantic mismatch — see §4. |
| `Parties Booking Reference` | *(none)* | **Missing — no target column** | Dojo's 5-char booking ref (e.g. `OSRLE`). All 14 unique. We have no column to store it. See §4. |
| `Parties Booking Time` | *(none)* | **Redundant / dropped** | UTC version of the booking time (1 hour behind the BST column). Not imported — we store local time. See §3. |
| `Parties Comments RMS` | *(none)* | **Dropped** | Internal restaurant-management-system notes. 0 of 14 populated. Not customer data — ignore. |
| `Parties Fulfilment Type - Bucketed` | *(none)* | **Dropped (filter)** | All `booked`. No status column on `Reservations` (a row existing = an active booking). Use as an import filter: only import `booked`. |
| `Parties Has Deposit (Yes / No)` | *(none)* | **Dropped** | All `No`. No payment/deposit concept in our schema. |
| `Parties Has Preauth (Yes / No)` | *(none)* | **Dropped** | All `No`. No pre-authorisation concept in our schema. |

### Target columns with no CSV source (must be generated)

| Target column | How to populate |
|---|---|
| `id` | Generate a UUID per row (matches `id TEXT PRIMARY KEY`). |
| `tenant_id` | **Must be supplied.** FK to the Red Cow tenant's `Tenants.id`. Look up / confirm before import. |
| `created_date` | Set to import timestamp, or let the schema default `CURRENT_TIMESTAMP` apply. |
| `modified_date` | Same as `created_date`. |
| `manage_token_hash` | Leave `NULL`. Per `DATA_MODEL.md`, NULL is valid for pre-migration rows; the amend/cancel link simply won't work until regenerated. |

## 3. ⚠️ Critical decision: which time column?

The CSV has **two** datetime columns that differ by exactly **1 hour**:

| `Parties Booking Time` | `Booking Time (BST)` |
|---|---|
| `2026-07-10 16:00:00` | `2026-07-10 17:00:00` |

`Parties Booking Time` is UTC; `Booking Time (BST)` is UK local time (British Summer Time, UTC+1). All 14 rows fall within BST (late-Mar → late-Oct), so every row is offset by +1h.

Our DB stores **naive local wall-clock** strings (`reservation_time` = `HH:MM`, no timezone) and all capacity/opening-hours logic in `BUSINESS_LOGIC.md` operates on local time. Therefore:

> **Import from `Booking Time (BST)`.** Using `Parties Booking Time` (UTC) would shift every booking 1 hour earlier and could break opening-hours validation and concurrency calculations.

## 4. Columns with no match — ignored (schema is the source of truth)

The schema will **not** be changed to accommodate the CSV. The following CSV columns have no matching or translatable target column and are therefore **ignored** on import. They are documented here so the loss is intentional and traceable:

| Ignored CSV column | Reason it is dropped |
|---|---|
| `Parties Booking Reference` | Dojo's unique 5-char booking ref (e.g. `OSRLE`). No column exists to hold it and none will be added. Reconciliation against Dojo must be done via the source CSV, not the DB. |
| `Parties Booking Time` | UTC duplicate of the booking time (see §3). We store naive local time only, so the UTC copy is redundant. |
| `Parties Comments RMS` | Internal restaurant-management-system notes. 0 of 14 populated, not customer data. |
| `Parties Fulfilment Type - Bucketed` | All `booked`. No status column exists (a row = an active booking). Used only as an import filter. |
| `Parties Has Deposit (Yes / No)` | All `No`. No payment/deposit concept in the schema. |
| `Parties Has Preauth (Yes / No)` | All `No`. No pre-authorisation concept in the schema. |

### Other things to be aware of before import

1. **`Comments Consumer` → `dietary_requirements` is a loose fit.** The comments are general notes ("dog with us", "wheelchair", "birthday cake"), not strictly dietary. It is the only free-text column available, so notes are stored there. The label is slightly misleading but no data is lost.
2. **Unique-booking constraint.** `idx_reservations_unique_booking` is `(tenant_id, email, reservation_date, reservation_time)`. All 14 rows are unique within the file. The insert uses `INSERT OR IGNORE` so any clash with existing live rows is skipped rather than erroring.
3. **Party size vs `max_guests`.** Largest party is **15** (`Paul Davis`, 2026-07-16). Confirm the Red Cow tenant's `max_guests` allows this; the import bypasses the API guard and inserts regardless, so this is a flag, not a blocker.

## 5. Timezone handling (naive time)

The system is timezone-naive: **the booked time is the time booked, stored verbatim.** For these 14 rows the correct wall-clock value is the `Booking Time (BST)` column, because **every booking date falls inside British Summer Time 2026** (BST runs 29 Mar 2026 → 25 Oct 2026; the bookings span 10 Jul → 2 Oct 2026). The `Parties Booking Time` (UTC) column is therefore ignored — using it would shift every booking 1 hour earlier.

> ⚠️ **If Dojo data is ever imported for dates outside BST (25 Oct 2026 – 29 Mar 2027, i.e. GMT/UTC), the two time columns will be identical and either can be used. Always take the local wall-clock time; do not blindly reuse this SQL for GMT-period bookings without re-checking.** This note is repeated as a comment in the SQL below.

## 6. Import SQL

Ready-to-run against the `Reservations` table. Notes:

- `tenant_id` is fixed to the Red Cow tenant `<tenant_id>`.
- `id` values are pre-generated UUIDs.
- `telephone` has the CSV's leading `'` text-guard stripped.
- `reservation_date` / `reservation_time` come from `Booking Time (BST)` (all rows are in BST — see §5).
- `manage_token_hash` is `NULL` (valid for imported rows; amend/cancel links won't work until regenerated).
- `created_date` / `modified_date` are omitted so the schema defaults (`CURRENT_TIMESTAMP`) apply.
- `INSERT OR IGNORE` respects the unique-booking index — safe to re-run.

```sql
-- Dojo import: Red Cow.csv → Reservations (14 rows)
-- Times are LOCAL wall-clock, taken from the CSV "Booking Time (BST)" column.
-- All bookings fall within British Summer Time 2026 (29 Mar–25 Oct 2026), so BST = local time.
-- WARNING: For any future import of GMT-period dates (25 Oct 2026–29 Mar 2027),
-- re-verify the source time column — do not assume the BST column blindly.
INSERT OR IGNORE INTO Reservations
  (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements, manage_token_hash)
VALUES
  ('<reservation_id>', '<tenant_id>', 'Dianne', 'Williams', '+447974086566', 'di.williams123@outlook.com', '2026-07-10', '17:00', 7, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'Andrew', 'Young', '+447972228002', '1964andrewyoung@googlemail.com', '2026-07-10', '17:30', 3, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'Heather', 'Tynan', '+447843859642', 'hevstockwelluk@yahoo.co.uk', '2026-07-10', '19:00', 7, 'We Will Have The Dog With Us', NULL),
  ('<reservation_id>', '<tenant_id>', 'Clare', 'Powell', '+447801517771', 'clarepowell@hotmail.co.uk', '2026-07-11', '12:30', 5, 'Will Have A Well Behaved Spaniel With Us ! Doggy Area Please!', NULL),
  ('<reservation_id>', '<tenant_id>', 'Sam', 'Young', '+447701337207', 'samjane68@live.co.uk', '2026-07-11', '18:30', 2, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'Shelagh', 'Taylor', '+447899938015', 'shelaghtaylor1@hotmail.co.uk', '2026-07-12', '12:00', 4, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'Melanie', 'GARBUTT', '+447539428453', 'mgarbutt313@gmail.com', '2026-07-12', '12:30', 4, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'Jane', 'Taylor', '+447790433858', 'janerog2512@gmail.com', '2026-07-12', '13:00', 7, 'I Am In A Small Manual Wheelchair', NULL),
  ('<reservation_id>', '<tenant_id>', 'Mary', 'Bolide', '+447860370127', 'babakin1@aol.com', '2026-07-15', '13:00', 4, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'Paul', 'Davis', '+447304131728', 'pardavid@hotmail.com', '2026-07-16', '16:30', 15, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'Graham', 'Dawkins', '+447708685821', 'graham.dawkins53@gmail.com', '2026-07-22', '12:30', 6, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'Ian', 'Whiteley', '+447307866261', 'ian.whiteley62@mail.com', '2026-07-24', '18:30', 4, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'David', 'Whitworth', '+447593533260', 'dpd.whitworth@btinternet.com', '2026-08-18', '13:00', 6, NULL, NULL),
  ('<reservation_id>', '<tenant_id>', 'Pam', 'Evans', '+447957518560', 'hughespame@aol.com', '2026-10-02', '17:45', 6, 'Birthday Meal. We May Have A Cake', NULL);
```

> Verify after running: `SELECT COUNT(*) FROM Reservations WHERE tenant_id = '<tenant_id>';` should increase by up to 14 (fewer if any row already existed and was skipped by `INSERT OR IGNORE`).

## 7. Summary

- **Direct matches (2):** `email`, `Party Size → guests`.
- **Translate to existing column (4):** `Booking Name → first_name+surname`, `Mobile → telephone` (strip `'`), `Booking Time (BST) → reservation_date+reservation_time`, `Comments Consumer → dietary_requirements`.
- **Generated (3):** `id`, `tenant_id`, `manage_token_hash` (NULL). `created_date` / `modified_date` use schema defaults.
- **Ignored — no schema match (6):** `Parties Booking Reference`, `Parties Booking Time` (UTC dup), `Comments RMS`, `Fulfilment Type` (filter only), `Has Deposit`, `Has Preauth`.
