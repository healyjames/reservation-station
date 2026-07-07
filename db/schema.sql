DROP TABLE IF EXISTS Tenants;

CREATE TABLE Tenants (
    id TEXT PRIMARY KEY NOT NULL, -- UUID stored as string
    name TEXT NOT NULL,
	tenant_code TEXT NOT NULL,
    max_guests INTEGER NOT NULL DEFAULT 0,
    max_covers INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')) DEFAULT 'active',
    concurrent_guests_time_limit INTEGER NOT NULL DEFAULT 120,
    contact_email TEXT NOT NULL DEFAULT '',
    created_date TEXT DEFAULT NULL,
    modified_date TEXT DEFAULT NULL
);

DROP TABLE IF EXISTS Reservations;

-- Create Reservations Table
CREATE TABLE Reservations (
    id TEXT PRIMARY KEY NOT NULL, -- UUID stored as string
    tenant_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    telephone TEXT NOT NULL,
    email TEXT NOT NULL,
    reservation_date TEXT NOT NULL, -- Format: YYYY-MM-DD
    reservation_time TEXT NOT NULL, -- Format: HH:MM
    guests INTEGER NOT NULL,
    dietary_requirements TEXT,
    created_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    modified_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    manage_token_hash TEXT,

    -- Foreign Key Constraint to ensure the tenant exists
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS AdminUsers;

CREATE TABLE AdminUsers (
    id          TEXT PRIMARY KEY NOT NULL,
    tenant_id   TEXT NOT NULL,
    email       TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    modified_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS BlockedDates;

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

DROP TABLE IF EXISTS OpeningHours;

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


CREATE INDEX idx_booking_tenant ON Reservations(tenant_id);
CREATE INDEX idx_reservations_tenant_date ON Reservations(tenant_id, reservation_date);
CREATE INDEX idx_blocked_dates_tenant_date ON BlockedDates(tenant_id, date);
CREATE INDEX idx_admin_users_tenant ON AdminUsers(tenant_id);
CREATE UNIQUE INDEX idx_reservations_unique_booking ON Reservations(tenant_id, email, reservation_date, reservation_time);
CREATE UNIQUE INDEX idx_tenants_code ON Tenants(tenant_code);
CREATE UNIQUE INDEX idx_admin_users_email ON AdminUsers(email);
