-- Add configurable booking delay (lead time) to Tenants.
-- Customers cannot book a slot that falls within `booking_delay_minutes` of the current time.
ALTER TABLE Tenants ADD COLUMN booking_delay_minutes INTEGER NOT NULL DEFAULT 0;
