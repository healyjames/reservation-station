-- H-3: Enforce uniqueness on Tenants.tenant_code.
-- The widget lookup uses tenant_code to find a tenant; a duplicate would silently
-- return whichever row D1 picks first, potentially serving one restaurant's data
-- under another's widget.
-- SQLite does not support ALTER INDEX, so drop and recreate.
DROP INDEX IF EXISTS idx_tenants_code;
CREATE UNIQUE INDEX idx_tenants_code ON Tenants(tenant_code);
