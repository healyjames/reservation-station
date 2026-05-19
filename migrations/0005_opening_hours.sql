CREATE TABLE OpeningHours (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
    open_time TEXT,
    close_time TEXT,
    UNIQUE (tenant_id, day_of_week),
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);
