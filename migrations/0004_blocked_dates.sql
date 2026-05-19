CREATE TABLE BlockedDates (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    reason TEXT,
    created_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_blocked_dates_tenant_date ON BlockedDates(tenant_id, date);

ALTER TABLE Tenants DROP COLUMN block_current_day;
