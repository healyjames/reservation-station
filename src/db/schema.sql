DROP TABLE IF EXISTS Tenants;

CREATE TABLE Tenants (
    id TEXT PRIMARY KEY NOT NULL, -- UUID stored as string
    name TEXT NOT NULL,
	tenant_code TEXT NOT NULL,
    max_guests INTEGER NOT NULL DEFAULT 0,
    max_covers INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')) DEFAULT 'active',
    block_current_day BOOLEAN NOT NULL DEFAULT FALSE,
    concurrent_guests_time_limit INTEGER NOT NULL DEFAULT 120
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

    -- Foreign Key Constraint to ensure the tenant exists
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);

-- Optional: Create an index on tenant_id for faster lookups
CREATE INDEX idx_booking_tenant ON Reservations(tenant_id);
CREATE INDEX idx_tenants_code ON Tenants(tenant_code);

INSERT INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, block_current_day, concurrent_guests_time_limit) VALUES
('6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'The Red Cow',        'redcow',        6,  50,  'active', 0, 120),
('59986b7d-a829-4315-9b49-f643ec83cf47', 'The Crown & Anchor', 'crownandanchor', 8,  80,  'active', 0, 120),
('bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'The Oak Tavern',     'oaktavern',      10, 100, 'active', 1, 120);

INSERT INTO Reservations (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements, created_date, modified_date) VALUES
('theredcow-1', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'John',     'Smith',   '7123456789', 'john.smith@email.com',      '2026-04-01', '18:00', 2, NULL,          '2026-04-01 18:45:39', '2026-04-01 18:45:39'),
('theredcow-2', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Emma',     'Brown',   '7234567890', 'emma.brown@email.com',      '2026-04-01', '19:00', 4, 'Vegetarian', '2026-04-01 18:45:39', '2026-04-01 18:45:39'),
('theredcow-3', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Liam',     'Jones',   '7345678901', 'liam.jones@email.com',      '2026-04-02', '20:00', 3, NULL,          '2026-04-01 18:45:39', '2026-04-01 18:45:39'),
('theredcow-4', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Olivia',   'Taylor',  '7456789012', 'olivia.taylor@email.com',   '2026-04-03', '17:30', 5, 'Gluten-free','2026-04-01 18:45:39', '2026-04-01 18:45:39'),
('theredcow-5', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Noah',     'Wilson',  '7567890123', 'noah.wilson@email.com',     '2026-04-04', '18:45', 2, NULL,          '2026-04-01 18:45:39', '2026-04-01 18:45:39'),
('thecrownandanchor-1', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Ava',      'Davies',  '7678901234', 'ava.davies@email.com',      '2026-04-01', '18:30', 6, NULL,          '2026-04-01 18:45:56', '2026-04-01 18:45:56'),
('thecrownandanchor-2', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Ethan',    'Evans',   '7789012345', 'ethan.evans@email.com',     '2026-04-01', '19:15', 2, 'Vegan',      '2026-04-01 18:45:56', '2026-04-01 18:45:56'),
('thecrownandanchor-3', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Sophia',   'Thomas',  '7890123456', 'sophia.thomas@email.com',   '2026-04-02', '20:30', 4, NULL,          '2026-04-01 18:45:56', '2026-04-01 18:45:56'),
('thecrownandanchor-4', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Mason',    'Roberts', '7901234567', 'mason.roberts@email.com',   '2026-04-03', '17:00', 3, NULL,          '2026-04-01 18:45:56', '2026-04-01 18:45:56'),
('thecrownandanchor-5', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Isabella', 'Walker',  '7012345678', 'isabella.walker@email.com', '2026-04-04', '21:00', 5, 'Nut allergy','2026-04-01 18:45:56', '2026-04-01 18:45:56'),
('theoakandtavern-1',   'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'James',    'Hall',    '7111111111', 'james.hall@email.com',      '2026-04-01', '18:00', 7, NULL,          '2026-04-01 18:46:08', '2026-04-01 18:46:08'),
('theoakandtavern-2',   'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Mia',      'Allen',   '7222222222', 'mia.allen@email.com',       '2026-04-01', '19:45', 2, 'Vegetarian', '2026-04-01 18:46:08', '2026-04-01 18:46:08'),
('theoakandtavern-3',   'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Benjamin', 'Young',   '7333333333', 'ben.young@email.com',       '2026-04-02', '20:15', 6, NULL,          '2026-04-01 18:46:08', '2026-04-01 18:46:08'),
('theoakandtavern-4',   'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Charlotte','King',    '7444444444', 'charlotte.king@email.com',  '2026-04-03', '18:30', 4, 'Dairy-free', '2026-04-01 18:46:08', '2026-04-01 18:46:08'),
('theoakandtavern-5',   'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Lucas',    'Scott',   '7555555555', 'lucas.scott@email.com',     '2026-04-04', '19:00', 3, NULL,          '2026-04-01 18:46:08', '2026-04-01 18:46:08');
