-- Seed today's bookings for all three tenants
-- Run locally:  npx wrangler d1 execute maximum_bookings_db --local --file src/db/seed-today.sql
-- Run remote:   npx wrangler d1 execute maximum_bookings_db --file src/db/seed-today.sql

-- The Red Cow (max_guests=6 per 120-min window)
-- Lunch: 12:00(2) + 13:00(3) = 5 concurrent ✓
-- Evening: 18:00(4) + 19:00(2) = 6 concurrent ✓ | 20:30 only overlaps with 19:00(2) → 4 ✓
INSERT INTO Reservations (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements) VALUES
('seed-today-rc-1', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Emma',  'Wilson',  '07700900001', 'emma.wilson@example.com',   '2026-05-15', '12:00', 2, NULL),
('seed-today-rc-2', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'James', 'Taylor',  '07700900002', 'james.taylor@example.com',  '2026-05-15', '13:00', 3, 'Vegetarian'),
('seed-today-rc-3', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Sarah', 'Mitchell','07700900003', 'sarah.mitchell@example.com','2026-05-15', '18:00', 4, 'Gluten-free'),
('seed-today-rc-4', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'David', 'Clark',   '07700900004', 'david.clark@example.com',   '2026-05-15', '19:00', 2, NULL),
('seed-today-rc-5', '6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d', 'Lucy',  'Brown',   '07700900005', 'lucy.brown@example.com',    '2026-05-15', '20:30', 2, 'Vegan');

-- The Crown & Anchor (max_guests=8 per 120-min window)
-- Lunch: 12:00(3) + 13:00(4) = 7 concurrent ✓
-- Evening: 18:00(5) + 19:00(3) = 8 concurrent ✓ | 20:00 only overlaps with 19:00(3) → 7 ✓
INSERT INTO Reservations (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements) VALUES
('seed-today-ca-1', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Oliver',    'Harris',   '07700900006', 'oliver.harris@example.com',   '2026-05-15', '12:00', 3, NULL),
('seed-today-ca-2', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Charlotte', 'Evans',    '07700900007', 'charlotte.evans@example.com', '2026-05-15', '13:00', 4, 'Nut allergy'),
('seed-today-ca-3', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Liam',      'Jones',    '07700900008', 'liam.jones@example.com',      '2026-05-15', '18:00', 5, NULL),
('seed-today-ca-4', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Amelia',    'White',    '07700900009', 'amelia.white@example.com',    '2026-05-15', '19:00', 3, 'Vegetarian'),
('seed-today-ca-5', '59986b7d-a829-4315-9b49-f643ec83cf47', 'Noah',      'Thomas',   '07700900010', 'noah.thomas@example.com',     '2026-05-15', '20:00', 4, NULL);

-- The Oak Tavern (max_guests=10 per 120-min window, block_current_day=1)
-- Note: block_current_day=1 means the widget blocks new same-day bookings,
-- but the admin UI will still display these.
-- Lunch: 12:00(4) + 13:00(5) = 9 concurrent ✓
-- Evening: 18:00(6) + 19:00(4) = 10 concurrent ✓ | 20:00 only overlaps with 19:00(4) → 7 ✓
INSERT INTO Reservations (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements) VALUES
('seed-today-ot-1', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Sophie', 'Martin',   '07700900011', 'sophie.martin@example.com',   '2026-05-15', '12:00', 4, NULL),
('seed-today-ot-2', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Ethan',  'Robinson', '07700900012', 'ethan.robinson@example.com',  '2026-05-15', '13:00', 5, 'Gluten-free'),
('seed-today-ot-3', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Isla',   'Thompson', '07700900013', 'isla.thompson@example.com',   '2026-05-15', '18:00', 6, NULL),
('seed-today-ot-4', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Harry',  'Jackson',  '07700900014', 'harry.jackson@example.com',   '2026-05-15', '19:00', 4, 'Vegan'),
('seed-today-ot-5', 'bac4bf8d-f05a-47b8-aab9-f1dc3710fb72', 'Grace',  'Lewis',    '07700900015', 'grace.lewis@example.com',     '2026-05-15', '20:00', 3, 'Nut allergy');
