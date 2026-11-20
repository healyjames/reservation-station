-- LOCAL DEVELOPMENT ONLY. NEVER run this against production (never with --remote).
-- It creates test admin logins with a published password and deletes and recreates seed bookings.
--
-- Seed three test tenants (with an admin login and weekly opening hours each) plus today's bookings.
-- Run:  npx wrangler d1 execute maximum_bookings_db --local --file=./db/seed-today.sql
--
-- Safe to re-run: tenants, admins and opening hours are only inserted if missing, and the seed reservations
-- are deleted and recreated for the current (UTC) date each time.

-- Tenants must exist first: Reservations.tenant_id has a FOREIGN KEY to Tenants(id).
INSERT OR IGNORE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit, booking_delay_minutes, contact_email, created_date, modified_date) VALUES
('6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'The Red Cow',        'the-red-cow',        6,  40, 'active', 120, 0, 'hello@the-red-cow.example.com',        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('59986b7d-a829-4315-9b49-f643ec83cf47', 'The Crown & Anchor', 'the-crown-and-anchor', 8,  50, 'active', 120, 0, 'hello@the-crown-and-anchor.example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'The Oak Tavern',     'the-oak-tavern',     10, 60, 'active', 120, 0, 'hello@the-oak-tavern.example.com',     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- One admin login per tenant. Password for all three: password123
-- Hash format matches src/utils/auth.ts hashPassword(): PBKDF2-SHA256, 100k iterations, "saltHex:hashHex".
INSERT OR IGNORE INTO AdminUsers (id, tenant_id, email, password_hash, failed_attempts, locked_until, created_date, modified_date) VALUES
('seed-admin-rc', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'admin@the-red-cow.example.com',          '7365656470617373776f726473616c74:a40c15927cf54924ff8f789c7e87134b3b94914bd21fb8546f01187fb0ff29c7', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('seed-admin-ca', '59986b7d-a829-4315-9b49-f643ec83cf47', 'admin@the-crown-and-anchor.example.com', '7365656470617373776f726473616c74:a40c15927cf54924ff8f789c7e87134b3b94914bd21fb8546f01187fb0ff29c7', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('seed-admin-ot', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'admin@the-oak-tavern.example.com',       '7365656470617373776f726473616c74:a40c15927cf54924ff8f789c7e87134b3b94914bd21fb8546f01187fb0ff29c7', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Opening hours: exactly seven rows per tenant (day_of_week 0 = Sunday … 6 = Saturday).
-- Every day is open so today's seed bookings (12:00–20:30) always fall inside trading hours.
-- The Oak Tavern's Fri/Sat hours cross midnight to exercise that path.
INSERT OR IGNORE INTO OpeningHours (id, tenant_id, day_of_week, is_closed, open_time, close_time) VALUES
('seed-oh-rc-0', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 0, 0, '11:00', '22:00'),
('seed-oh-rc-1', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 1, 0, '11:00', '23:00'),
('seed-oh-rc-2', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 2, 0, '11:00', '23:00'),
('seed-oh-rc-3', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 3, 0, '11:00', '23:00'),
('seed-oh-rc-4', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 4, 0, '11:00', '23:00'),
('seed-oh-rc-5', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 5, 0, '11:00', '23:00'),
('seed-oh-rc-6', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 6, 0, '11:00', '23:00'),
('seed-oh-ca-0', '59986b7d-a829-4315-9b49-f643ec83cf47', 0, 0, '12:00', '22:00'),
('seed-oh-ca-1', '59986b7d-a829-4315-9b49-f643ec83cf47', 1, 0, '12:00', '22:30'),
('seed-oh-ca-2', '59986b7d-a829-4315-9b49-f643ec83cf47', 2, 0, '12:00', '22:30'),
('seed-oh-ca-3', '59986b7d-a829-4315-9b49-f643ec83cf47', 3, 0, '12:00', '22:30'),
('seed-oh-ca-4', '59986b7d-a829-4315-9b49-f643ec83cf47', 4, 0, '12:00', '22:30'),
('seed-oh-ca-5', '59986b7d-a829-4315-9b49-f643ec83cf47', 5, 0, '12:00', '23:00'),
('seed-oh-ca-6', '59986b7d-a829-4315-9b49-f643ec83cf47', 6, 0, '12:00', '23:00'),
('seed-oh-ot-0', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 0, 0, '11:30', '22:00'),
('seed-oh-ot-1', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 1, 0, '11:30', '23:00'),
('seed-oh-ot-2', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 2, 0, '11:30', '23:00'),
('seed-oh-ot-3', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 3, 0, '11:30', '23:00'),
('seed-oh-ot-4', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 4, 0, '11:30', '23:00'),
('seed-oh-ot-5', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 5, 0, '11:30', '00:30'),
('seed-oh-ot-6', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 6, 0, '11:30', '00:30');

-- Clear previous seed bookings so the fixed ids don't collide on re-run.
DELETE FROM Reservations WHERE id LIKE 'seed-today-%';

-- The Red Cow (max_guests=6 per 120-min window)
-- Lunch: 12:00(2) + 13:00(3) = 5 concurrent ✓
-- Evening: 18:00(4) + 19:00(2) = 6 concurrent ✓ | 20:30 only overlaps with 19:00(2) → 4 ✓
INSERT INTO Reservations (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements) VALUES
('seed-today-rc-1', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Emma',  'Wilson',  '07700900001', 'emma.wilson@example.com',   date('now'), '12:00', 2, NULL),
('seed-today-rc-2', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'James', 'Taylor',  '07700900002', 'james.taylor@example.com',  date('now'), '13:00', 3, 'Vegetarian'),
('seed-today-rc-3', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Sarah', 'Mitchell','07700900003', 'sarah.mitchell@example.com',date('now'), '18:00', 4, 'Gluten-free'),
('seed-today-rc-4', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'David', 'Clark',   '07700900004', 'david.clark@example.com',   date('now'), '19:00', 2, NULL),
('seed-today-rc-5', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Lucy',  'Brown',   '07700900005', 'lucy.brown@example.com',    date('now'), '20:30', 2, 'Vegan');

-- The Crown & Anchor (max_guests=8 per 120-min window)
-- Lunch: 12:00(3) + 13:00(4) = 7 concurrent ✓
-- Evening: 18:00(5) + 19:00(3) = 8 concurrent ✓ | 20:00 only overlaps with 19:00(3) → 7 ✓
INSERT INTO Reservations (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements) VALUES
('seed-today-ca-1', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Oliver',    'Harris',   '07700900006', 'oliver.harris@example.com',   date('now'), '12:00', 3, NULL),
('seed-today-ca-2', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Charlotte', 'Evans',    '07700900007', 'charlotte.evans@example.com', date('now'), '13:00', 4, 'Nut allergy'),
('seed-today-ca-3', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Liam',      'Jones',    '07700900008', 'liam.jones@example.com',      date('now'), '18:00', 5, NULL),
('seed-today-ca-4', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Amelia',    'White',    '07700900009', 'amelia.white@example.com',    date('now'), '19:00', 3, 'Vegetarian'),
('seed-today-ca-5', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Noah',      'Thomas',   '07700900010', 'noah.thomas@example.com',     date('now'), '20:00', 4, NULL);

-- The Oak Tavern (max_guests=10 per 120-min window)
-- Lunch: 12:00(4) + 13:00(5) = 9 concurrent ✓
-- Evening: 18:00(6) + 19:00(4) = 10 concurrent ✓ | 20:00 only overlaps with 19:00(4) → 7 ✓
INSERT INTO Reservations (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements) VALUES
('seed-today-ot-1', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Sophie', 'Martin',   '07700900011', 'sophie.martin@example.com',   date('now'), '12:00', 4, NULL),
('seed-today-ot-2', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Ethan',  'Robinson', '07700900012', 'ethan.robinson@example.com',  date('now'), '13:00', 5, 'Gluten-free'),
('seed-today-ot-3', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Isla',   'Thompson', '07700900013', 'isla.thompson@example.com',   date('now'), '18:00', 6, NULL),
('seed-today-ot-4', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Harry',  'Jackson',  '07700900014', 'harry.jackson@example.com',   date('now'), '19:00', 4, 'Vegan'),
('seed-today-ot-5', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Grace',  'Lewis',    '07700900015', 'grace.lewis@example.com',     date('now'), '20:00', 3, 'Nut allergy');
