DROP TABLE IF EXISTS Tenants;
-- Create Tenants Table
CREATE TABLE Tenants (
    id TEXT PRIMARY KEY NOT NULL, -- UUID stored as string
    name TEXT NOT NULL,
    max_guests INTEGER NOT NULL DEFAULT 0,
    max_covers INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')) DEFAULT 'active',
    block_current_day BOOLEAN NOT NULL DEFAULT FALSE
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

INSERT INTO Tenants (id, name, max_guests, max_covers, status, block_current_day) VALUES
('6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'The Red Cow', 6, 50, 'active', FALSE),
('59986b7d-a829-4315-9b49-f643ec83cf47', 'The Crown & Anchor', 8, 80, 'active', FALSE),
('bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'The Oak Tavern', 10, 100, 'active', TRUE);

INSERT INTO Reservations (
    id, tenant_id, first_name, surname, telephone, email,
    reservation_date, reservation_time, guests, dietary_requirements
) VALUES
('theredcow-1', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'John', 'Smith', '07123456789', 'john.smith@email.com', '2026-04-01', '18:00', 2, NULL),
('theredcow-2', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Emma', 'Brown', '07234567890', 'emma.brown@email.com', '2026-04-01', '19:00', 4, 'Vegetarian'),
('theredcow-3', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Liam', 'Jones', '07345678901', 'liam.jones@email.com', '2026-04-02', '20:00', 3, NULL),
('theredcow-4', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Olivia', 'Taylor', '07456789012', 'olivia.taylor@email.com', '2026-04-03', '17:30', 5, 'Gluten-free'),
('theredcow-5', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Noah', 'Wilson', '07567890123', 'noah.wilson@email.com', '2026-04-04', '18:45', 2, NULL);

INSERT INTO Reservations (
    id, tenant_id, first_name, surname, telephone, email,
    reservation_date, reservation_time, guests, dietary_requirements
) VALUES
('thecrownandanchor-1', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Ava', 'Davies', '07678901234', 'ava.davies@email.com', '2026-04-01', '18:30', 6, NULL),
('thecrownandanchor-2', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Ethan', 'Evans', '07789012345', 'ethan.evans@email.com', '2026-04-01', '19:15', 2, 'Vegan'),
('thecrownandanchor-3', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Sophia', 'Thomas', '07890123456', 'sophia.thomas@email.com', '2026-04-02', '20:30', 4, NULL),
('thecrownandanchor-4', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Mason', 'Roberts', '07901234567', 'mason.roberts@email.com', '2026-04-03', '17:00', 3, NULL),
('thecrownandanchor-5', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Isabella', 'Walker', '07012345678', 'isabella.walker@email.com', '2026-04-04', '21:00', 5, 'Nut allergy');

INSERT INTO Reservations (
    id, tenant_id, first_name, surname, telephone, email,
    reservation_date, reservation_time, guests, dietary_requirements
) VALUES
('theoakandtavern-1', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'James', 'Hall', '07111111111', 'james.hall@email.com', '2026-04-01', '18:00', 7, NULL),
('theoakandtavern-2', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Mia', 'Allen', '07222222222', 'mia.allen@email.com', '2026-04-01', '19:45', 2, 'Vegetarian'),
('theoakandtavern-3', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Benjamin', 'Young', '07333333333', 'ben.young@email.com', '2026-04-02', '20:15', 6, NULL),
('theoakandtavern-4', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Charlotte', 'King', '07444444444', 'charlotte.king@email.com', '2026-04-03', '18:30', 4, 'Dairy-free'),
('theoakandtavern-5', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Lucas', 'Scott', '07555555555', 'lucas.scott@email.com', '2026-04-04', '19:00', 3, NULL);