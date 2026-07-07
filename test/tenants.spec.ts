import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

const TENANT_ID = '00000000-0000-4000-8000-000000002001';
const TENANT_ID_2 = '00000000-0000-4000-8000-000000002002';
const TENANT_ID_3 = '00000000-0000-4000-8000-000000002003';
const OPENING_HOURS_ID_1 = '00000000-0000-4000-8000-000000002051';
const OPENING_HOURS_ID_2 = '00000000-0000-4000-8000-000000002052';
const UNKNOWN_TENANT_ID = '00000000-0000-4000-8000-000000002099';

async function seedTenant(overrides: Record<string, unknown> = {}) {
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit, contact_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id ?? TENANT_ID,
      overrides.name ?? 'Test Tenant',
      overrides.tenant_code ?? 'test-tenant',
      overrides.max_guests ?? 50,
      overrides.max_covers ?? 20,
      overrides.status ?? 'active',
      overrides.concurrent_guests_time_limit ?? 120,
      overrides.contact_email ?? 'owner@testvenant.com',
    )
    .run();
}

async function seedOpeningHours(overrides: Record<string, unknown> = {}) {
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO OpeningHours (id, tenant_id, day_of_week, is_closed, open_time, close_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id ?? OPENING_HOURS_ID_1,
      overrides.tenant_id ?? TENANT_ID,
      overrides.day_of_week ?? 0,
      overrides.is_closed ?? 0,
      overrides.open_time ?? '12:00',
      overrides.close_time ?? '22:00',
    )
    .run();
}

async function ensureDbSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS Tenants (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      tenant_code TEXT NOT NULL,
      max_guests INTEGER NOT NULL DEFAULT 0,
      max_covers INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')) DEFAULT 'active',
      concurrent_guests_time_limit INTEGER NOT NULL DEFAULT 120,
      contact_email TEXT NOT NULL DEFAULT '',
      created_date TEXT DEFAULT NULL,
      modified_date TEXT DEFAULT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS Reservations (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      surname TEXT NOT NULL,
      telephone TEXT NOT NULL,
      email TEXT NOT NULL,
      reservation_date TEXT NOT NULL,
      reservation_time TEXT NOT NULL,
      guests INTEGER NOT NULL,
      dietary_requirements TEXT,
      created_date TEXT DEFAULT (CURRENT_TIMESTAMP),
      modified_date TEXT DEFAULT (CURRENT_TIMESTAMP),
      manage_token_hash TEXT,
      FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS AdminUsers (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_date TEXT DEFAULT (CURRENT_TIMESTAMP),
      modified_date TEXT DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS OpeningHours (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
      open_time TEXT,
      close_time TEXT,
      UNIQUE (tenant_id, day_of_week),
      FOREIGN KEY (tenant_id) REFERENCES Tenants(id) ON DELETE CASCADE
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_code ON Tenants(tenant_code)',
    'CREATE INDEX IF NOT EXISTS idx_booking_tenant ON Reservations(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_reservations_tenant_date ON Reservations(tenant_id, reservation_date)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_unique_booking ON Reservations(tenant_id, email, reservation_date, reservation_time)',
    'CREATE INDEX IF NOT EXISTS idx_admin_users_tenant ON AdminUsers(tenant_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON AdminUsers(email)',
  ];

  for (const statement of statements) {
    await env.maximum_bookings_db.prepare(statement).run();
  }
}

async function clearDb() {
  await env.maximum_bookings_db
    .prepare('DELETE FROM OpeningHours')
    .run()
    .catch(() => {});
  await env.maximum_bookings_db
    .prepare('DELETE FROM AdminUsers')
    .run()
    .catch(() => {});
  await env.maximum_bookings_db
    .prepare('DELETE FROM Reservations')
    .run()
    .catch(() => {});
  await env.maximum_bookings_db
    .prepare('DELETE FROM Tenants')
    .run()
    .catch(() => {});
}

function getAdminKey(): string {
  const key = (env as any).SUPER_ADMIN_KEY as string | undefined;
  if (!key) {
    throw new Error('SUPER_ADMIN_KEY is not configured for tests');
  }
  return key;
}

function adminHeaders(headers: Record<string, string> = {}) {
  return {
    'X-Admin-Key': getAdminKey(),
    ...headers,
  };
}

const ADMIN_PASSWORD = 'super-secure-password-2099';

type OnboardingBody = {
  tenant: Record<string, unknown>;
  admin: Record<string, unknown>;
  opening_hours?: unknown;
};

function onboardingBody(
  slug: string,
  overrides: { tenant?: Record<string, unknown>; admin?: Record<string, unknown>; opening_hours?: unknown } = {},
): OnboardingBody {
  const body: OnboardingBody = {
    tenant: {
      name: `Created ${slug}`,
      tenant_code: slug,
      max_guests: 30,
      max_covers: 10,
      status: 'active',
      concurrent_guests_time_limit: 90,
      contact_email: `owner-${slug}@testvenant.com`,
      ...overrides.tenant,
    },
    admin: {
      email: `admin-${slug}@testvenant.com`,
      password: ADMIN_PASSWORD,
      ...overrides.admin,
    },
  };

  if ('opening_hours' in overrides) {
    body.opening_hours = overrides.opening_hours;
  }

  return body;
}

function onboardingHeaders(headers: Record<string, string> = {}) {
  return adminHeaders({ 'Content-Type': 'application/json', ...headers });
}

async function countRows(table: 'Tenants' | 'AdminUsers' | 'OpeningHours', where = '', binds: unknown[] = []) {
  const row = await env.maximum_bookings_db
    .prepare(`SELECT COUNT(*) AS count FROM ${table}${where ? ` WHERE ${where}` : ''}`)
    .bind(...binds)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

async function expectNoOnboardingRows() {
  expect(await countRows('Tenants')).toBe(0);
  expect(await countRows('AdminUsers')).toBe(0);
  expect(await countRows('OpeningHours')).toBe(0);
}

beforeEach(async () => {
  await ensureDbSchema();
  await clearDb();
});

describe('GET /api/tenants', () => {
  it('returns 401 when X-Admin-Key header is missing', async () => {
    const res = await exports.default.fetch('http://localhost/api/tenants');
    const body = (await res.json()) as any;
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when X-Admin-Key is incorrect', async () => {
    const res = await exports.default.fetch('http://localhost/api/tenants', {
      headers: { 'X-Admin-Key': 'wrong-admin-key' },
    });
    const body = (await res.json()) as any;
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns all tenants with valid X-Admin-Key', async () => {
    await seedTenant({ id: TENANT_ID, name: 'Alpha Venue', tenant_code: 'alpha-venue' });
    await seedTenant({ id: TENANT_ID_2, name: 'Beta Venue', tenant_code: 'beta-venue' });

    const res = await exports.default.fetch('http://localhost/api/tenants', {
      headers: adminHeaders(),
    });
    const body = (await res.json()) as any[];

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body.every((tenant: any) => tenant.id && tenant.name)).toBe(true);
  });

  it('returns empty array when no tenants exist', async () => {
    const res = await exports.default.fetch('http://localhost/api/tenants', {
      headers: adminHeaders(),
    });
    const body = (await res.json()) as any[];

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe('GET /api/tenants/:id', () => {
  it('returns tenant by UUID without contact_email', async () => {
    await seedTenant({ id: TENANT_ID, name: 'Widget Venue', tenant_code: 'widget-venue' });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`);
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.id).toBe(TENANT_ID);
    expect(body.name).toBe('Widget Venue');
    expect(body.tenant_code).toBe('widget-venue');
    expect(body.contact_email).toBeUndefined();
  });

  it('returns tenant by tenant_code without contact_email', async () => {
    await seedTenant({ id: TENANT_ID, name: 'Code Venue', tenant_code: 'code-venue' });

    const res = await exports.default.fetch('http://localhost/api/tenants/code-venue');
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.id).toBe(TENANT_ID);
    expect(body.tenant_code).toBe('code-venue');
    expect(body.contact_email).toBeUndefined();
  });

  it('does not include contact_email in response', async () => {
    await seedTenant({ id: TENANT_ID, contact_email: 'hidden@testvenant.com' });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`);
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.contact_email).toBeUndefined();
    expect(Object.keys(body)).not.toContain('contact_email');
  });

  it('does not include created_date or modified_date in response', async () => {
    await seedTenant({ id: TENANT_ID });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`);
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.created_date).toBeUndefined();
    expect(body.modified_date).toBeUndefined();
    expect(Object.keys(body)).not.toContain('created_date');
    expect(Object.keys(body)).not.toContain('modified_date');
  });

  it('returns opening_hours when configured', async () => {
    await seedTenant({ id: TENANT_ID });
    await seedOpeningHours({ id: OPENING_HOURS_ID_1, tenant_id: TENANT_ID, day_of_week: 0, open_time: '12:00', close_time: '22:00' });
    await seedOpeningHours({ id: OPENING_HOURS_ID_2, tenant_id: TENANT_ID, day_of_week: 1, open_time: '11:00', close_time: '21:00' });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`);
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(Array.isArray(body.opening_hours)).toBe(true);
    expect(body.opening_hours).toHaveLength(2);
    expect(body.opening_hours[0].day_of_week).toBe(0);
    expect(body.opening_hours[1].day_of_week).toBe(1);
  });

  it('returns opening_hours as null when not configured', async () => {
    await seedTenant({ id: TENANT_ID });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`);
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.opening_hours).toBeNull();
  });

  it('returns 404 for unknown tenant id', async () => {
    const res = await exports.default.fetch(`http://localhost/api/tenants/${UNKNOWN_TENANT_ID}`);
    const body = (await res.json()) as any;

    expect(res.status).toBe(404);
    expect(body.error).toBe('Tenant not found');
  });
});

describe('POST /api/tenants', () => {
  it('returns 401 when X-Admin-Key header is missing for a nested onboarding body', async () => {
    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(onboardingBody('unauthorized-missing-key')),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(401);
    expect(body).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns 401 when X-Admin-Key is incorrect for a nested onboarding body', async () => {
    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'wrong-admin-key' },
      body: JSON.stringify(onboardingBody('unauthorized-invalid-key')),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(401);
    expect(body).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('creates tenant admin and seven closed opening-hours rows when opening_hours is omitted', async () => {
    const requestBody = onboardingBody('onboarding-default-hours', {
      tenant: {
        name: 'Default Hours Venue',
        tenant_code: 'onboarding-default-hours',
        concurrent_guests_time_limit: 90,
        contact_email: 'owner-default-hours@testvenant.com',
      },
      admin: { email: 'admin-default-hours@testvenant.com' },
    });

    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(requestBody),
    });
    const body = (await res.json()) as any;
    const tenantId = body.data?.tenant?.id;
    const tenant = await env.maximum_bookings_db
      .prepare('SELECT id, name, tenant_code, contact_email, concurrent_guests_time_limit FROM Tenants WHERE id = ?')
      .bind(tenantId)
      .first<{ id: string; name: string; tenant_code: string; contact_email: string; concurrent_guests_time_limit: number }>();
    const admin = await env.maximum_bookings_db
      .prepare('SELECT tenant_id, email, password_hash FROM AdminUsers WHERE tenant_id = ?')
      .bind(tenantId)
      .first<{ tenant_id: string; email: string; password_hash: string }>();
    const { results: openingHours } = await env.maximum_bookings_db
      .prepare('SELECT day_of_week, is_closed, open_time, close_time FROM OpeningHours WHERE tenant_id = ? ORDER BY day_of_week ASC')
      .bind(tenantId)
      .run<{ day_of_week: number; is_closed: number; open_time: string | null; close_time: string | null }>();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.tenant.id).toBeDefined();
    expect(body.data.tenant.tenant_code).toBe('onboarding-default-hours');
    expect(body.data.tenant.name).toBe('Default Hours Venue');
    expect(body.data.admin.email).toBe('admin-default-hours@testvenant.com');
    expect(JSON.stringify(body)).not.toContain('password_hash');
    expect(await countRows('Tenants')).toBe(1);
    expect(tenant).toEqual({
      id: tenantId,
      name: 'Default Hours Venue',
      tenant_code: 'onboarding-default-hours',
      contact_email: 'owner-default-hours@testvenant.com',
      concurrent_guests_time_limit: 90,
    });
    expect(await countRows('AdminUsers', 'tenant_id = ?', [tenantId])).toBe(1);
    expect(admin?.tenant_id).toBe(tenantId);
    expect(admin?.email).toBe('admin-default-hours@testvenant.com');
    expect(admin?.password_hash).toBeDefined();
    expect(openingHours).toHaveLength(7);
    expect(openingHours.map((row) => row.day_of_week)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(openingHours.every((row) => row.is_closed === 1 && row.open_time === null && row.close_time === null)).toBe(true);
  });

  it('creates seven provided opening-hours rows with open and closed days', async () => {
    const providedOpeningHours = [
      { day_of_week: 0, is_closed: 1, open_time: null, close_time: null },
      { day_of_week: 1, is_closed: 0, open_time: '12:00', close_time: '21:30' },
      { day_of_week: 2, is_closed: 0, open_time: '12:00', close_time: '21:30' },
      { day_of_week: 3, is_closed: 0, open_time: '13:00', close_time: '22:00' },
      { day_of_week: 4, is_closed: 0, open_time: '13:00', close_time: '22:00' },
      { day_of_week: 5, is_closed: 0, open_time: '12:00', close_time: '23:00' },
      { day_of_week: 6, is_closed: 1, open_time: null, close_time: null },
    ];

    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(onboardingBody('onboarding-custom-hours', { opening_hours: providedOpeningHours })),
    });
    const body = (await res.json()) as any;
    const tenantId = body.data?.tenant?.id;
    const { results: openingHours } = await env.maximum_bookings_db
      .prepare('SELECT day_of_week, is_closed, open_time, close_time FROM OpeningHours WHERE tenant_id = ? ORDER BY day_of_week ASC')
      .bind(tenantId)
      .run<{ day_of_week: number; is_closed: number; open_time: string | null; close_time: string | null }>();

    expect(res.status).toBe(201);
    expect(openingHours).toEqual(providedOpeningHours);
  });

  it('creates an admin who can log in with the onboarding password', async () => {
    const requestBody = onboardingBody('onboarding-login', {
      admin: { email: 'admin-login@testvenant.com', password: 'login-password-2099' },
    });

    const onboardingRes = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(requestBody),
    });
    const loginRes = await exports.default.fetch('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin-login@testvenant.com', password: 'login-password-2099' }),
    });
    const loginBody = (await loginRes.json()) as any;

    expect(onboardingRes.status).toBe(201);
    expect(loginRes.status).toBe(200);
    expect(loginBody.success).toBe(true);
    expect(typeof loginBody.data.token).toBe('string');
    expect(loginBody.data.token.length).toBeGreaterThan(0);
  });

  it('returns 409 for duplicate tenant_code and creates no admin or opening-hours rows', async () => {
    await seedTenant({ tenant_code: 'duplicate-code' });

    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(onboardingBody('duplicate-code', { admin: { email: 'admin-duplicate-code@testvenant.com' } })),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(409);
    expect(body).toEqual({ success: false, error: 'A tenant with that tenant_code already exists' });
    expect(await countRows('Tenants')).toBe(1);
    expect(await countRows('AdminUsers')).toBe(0);
    expect(await countRows('OpeningHours')).toBe(0);
  });

  it('returns 409 for duplicate admin email and rolls back tenant and opening-hours rows', async () => {
    const firstRes = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(onboardingBody('duplicate-email-a', { admin: { email: 'shared-admin@testvenant.com' } })),
    });
    const secondRes = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(onboardingBody('duplicate-email-b', { admin: { email: 'shared-admin@testvenant.com' } })),
    });
    const body = (await secondRes.json()) as any;

    expect(firstRes.status).toBe(201);
    expect(secondRes.status).toBe(409);
    expect(body).toEqual({ success: false, error: 'An admin with that email already exists' });
    expect(await countRows('Tenants', 'tenant_code = ?', ['duplicate-email-b'])).toBe(0);
    expect(await countRows('OpeningHours', 'tenant_id NOT IN (SELECT id FROM Tenants)')).toBe(0);
    expect(await countRows('Tenants')).toBe(1);
    expect(await countRows('AdminUsers')).toBe(1);
    expect(await countRows('OpeningHours')).toBe(7);
  });

  it('returns 400 and creates nothing when tenant.name is missing', async () => {
    const requestBody = onboardingBody('missing-name');
    delete requestBody.tenant.name;

    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(requestBody),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    await expectNoOnboardingRows();
  });

  it('returns 400 and creates nothing when tenant.tenant_code is missing', async () => {
    const requestBody = onboardingBody('missing-tenant-code');
    delete requestBody.tenant.tenant_code;

    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(requestBody),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    await expectNoOnboardingRows();
  });

  it('returns 400 and creates nothing when tenant.contact_email is invalid', async () => {
    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(onboardingBody('invalid-contact-email', { tenant: { contact_email: 'not-an-email' } })),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    await expectNoOnboardingRows();
  });

  it('returns 400 and creates nothing when admin.email is invalid', async () => {
    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(onboardingBody('invalid-admin-email', { admin: { email: 'not-an-email' } })),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    await expectNoOnboardingRows();
  });

  it('returns 400 and creates nothing when admin.password is shorter than 8 characters', async () => {
    const res = await exports.default.fetch('http://localhost/api/tenants', {
      method: 'POST',
      headers: onboardingHeaders(),
      body: JSON.stringify(onboardingBody('short-admin-password', { admin: { password: 'short' } })),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    await expectNoOnboardingRows();
  });
});

describe('PATCH /api/tenants/:id', () => {
  it('returns 401 when X-Admin-Key header is missing', async () => {
    await seedTenant({ id: TENANT_ID });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Tenant Name' }),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when X-Admin-Key is incorrect', async () => {
    await seedTenant({ id: TENANT_ID });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'wrong-admin-key' },
      body: JSON.stringify({ name: 'Updated Tenant Name' }),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('updates tenant name with valid X-Admin-Key', async () => {
    await seedTenant({ id: TENANT_ID, name: 'Original Tenant Name' });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`, {
      method: 'PATCH',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: 'Updated Tenant Name' }),
    });
    const body = (await res.json()) as any;
    const row = await env.maximum_bookings_db.prepare('SELECT name FROM Tenants WHERE id = ?').bind(TENANT_ID).first<{ name: string }>();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(row?.name).toBe('Updated Tenant Name');
  });
});

describe('DELETE /api/tenants/:id', () => {
  it('returns 401 when X-Admin-Key header is missing', async () => {
    await seedTenant({ id: TENANT_ID });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`, {
      method: 'DELETE',
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when X-Admin-Key is incorrect', async () => {
    await seedTenant({ id: TENANT_ID });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Key': 'wrong-admin-key' },
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('deletes tenant with valid X-Admin-Key', async () => {
    await seedTenant({ id: TENANT_ID_3, tenant_code: 'delete-venue' });

    const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID_3}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    const body = (await res.json()) as any;
    const row = await env.maximum_bookings_db.prepare('SELECT id FROM Tenants WHERE id = ?').bind(TENANT_ID_3).first();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(row).toBeNull();
  });

  it('returns 404 when tenant does not exist', async () => {
    const res = await exports.default.fetch(`http://localhost/api/tenants/${UNKNOWN_TENANT_ID}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(404);
    expect(body.error).toBe('Tenant not found');
  });
});
