-- H-6: Add manage_token_hash to Reservations.
-- Stores SHA-256(HMAC-SHA256(JWT_SECRET, "manage:{id}:{email}")) to authenticate
-- customer-facing PATCH/DELETE requests without requiring admin credentials.
-- NULL on pre-migration rows; those reservations require a new booking to get a token.
ALTER TABLE Reservations ADD COLUMN manage_token_hash TEXT;
