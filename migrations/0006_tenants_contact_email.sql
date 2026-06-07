-- Add contact_email to Tenants for per-tenant email configuration
ALTER TABLE Tenants ADD COLUMN contact_email TEXT NOT NULL DEFAULT '';
