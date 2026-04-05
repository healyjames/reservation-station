-- Add configurable concurrent guest time window to Tenants
ALTER TABLE Tenants ADD COLUMN concurrent_guests_time_limit INTEGER NOT NULL DEFAULT 120;
