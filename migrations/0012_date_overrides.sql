-- DateOverrides: special opening hours for one specific date.
-- A row replaces OpeningHours(day_of_week) for that date only.
--   is_closed = 0: the venue is open on this date with open_time/close_time.
--   is_closed = 1: the venue is closed on this date; times are NULL.
-- UNIQUE (tenant_id, date) allows at most one override per date per tenant (and indexes the lookup).
CREATE TABLE DateOverrides (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    date TEXT NOT NULL,
    is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
    open_time TEXT,
    close_time TEXT,
    reason TEXT,
    created_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE (tenant_id, date),
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);
