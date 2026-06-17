-- H-2: Add composite index on Reservations(tenant_id, reservation_date).
-- All hot queries (blocked-times, availability, POST capacity check, admin list)
-- filter on both columns. Without this index D1 scans all rows for the tenant
-- to evaluate the date predicate.
CREATE INDEX idx_reservations_tenant_date ON Reservations(tenant_id, reservation_date);
