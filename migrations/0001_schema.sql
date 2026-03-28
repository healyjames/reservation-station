CREATE TABLE Tenants (
    id TEXT PRIMARY KEY NOT NULL, -- UUID stored as string
    name TEXT NOT NULL,
    max_guests INTEGER NOT NULL DEFAULT 0,
    max_covers INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')) DEFAULT 'active',
    block_current_day BOOLEAN NOT NULL DEFAULT FALSE
);

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
    
    -- Foreign Key Constraint to ensure the tenant exists
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);

-- Optional: Create an index on tenant_id for faster lookups
CREATE INDEX idx_booking_tenant ON Reservations(tenant_id);