-- H-4: Prevent duplicate bookings for the same customer, date, and time slot.
-- Without this constraint a double-click or browser retry silently creates two
-- identical reservations, consuming capacity and sending duplicate emails.
CREATE UNIQUE INDEX idx_reservations_unique_booking
  ON Reservations(tenant_id, email, reservation_date, reservation_time);
