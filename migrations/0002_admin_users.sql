CREATE TABLE AdminUsers (
    id          TEXT PRIMARY KEY NOT NULL,
    tenant_id   TEXT NOT NULL,
    email       TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    modified_date TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_admin_users_email ON AdminUsers(email);
CREATE INDEX idx_admin_users_tenant ON AdminUsers(tenant_id);
