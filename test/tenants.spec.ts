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

async function clearDb() {
	await env.maximum_bookings_db.prepare('DELETE FROM OpeningHours').run().catch(() => {});
	await env.maximum_bookings_db.prepare('DELETE FROM AdminUsers').run().catch(() => {});
	await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run().catch(() => {});
	await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run().catch(() => {});
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

beforeEach(async () => {
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
	it('returns 401 when X-Admin-Key header is missing', async () => {
		const res = await exports.default.fetch('http://localhost/api/tenants', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Created Venue',
				tenant_code: 'created-venue',
				max_guests: 30,
				max_covers: 10,
				status: 'active',
				concurrent_guests_time_limit: 120,
				contact_email: 'created@testvenant.com',
			}),
		});
		const body = (await res.json()) as any;

		expect(res.status).toBe(401);
		expect(body.error).toBe('Unauthorized');
	});

	it('returns 401 when X-Admin-Key is incorrect', async () => {
		const res = await exports.default.fetch('http://localhost/api/tenants', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'wrong-admin-key' },
			body: JSON.stringify({
				name: 'Created Venue',
				tenant_code: 'created-venue',
				max_guests: 30,
				max_covers: 10,
				status: 'active',
				concurrent_guests_time_limit: 120,
				contact_email: 'created@testvenant.com',
			}),
		});
		const body = (await res.json()) as any;

		expect(res.status).toBe(401);
		expect(body.error).toBe('Unauthorized');
	});

	it('creates a tenant with valid X-Admin-Key and returns 201', async () => {
		const res = await exports.default.fetch('http://localhost/api/tenants', {
			method: 'POST',
			headers: adminHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				name: 'Created Venue',
				tenant_code: 'created-venue',
				max_guests: 30,
				max_covers: 10,
				status: 'active',
				concurrent_guests_time_limit: 90,
				contact_email: 'created@testvenant.com',
			}),
		});
		const body = (await res.json()) as any;
		const row = await env.maximum_bookings_db
			.prepare('SELECT name, tenant_code, contact_email FROM Tenants WHERE id = ?')
			.bind(body.id)
			.first<{ name: string; tenant_code: string; contact_email: string }>();

		expect(res.status).toBe(201);
		expect(body.id).toBeDefined();
		expect(body.name).toBe('Created Venue');
		expect(body.tenant_code).toBe('created-venue');
		expect(row?.name).toBe('Created Venue');
		expect(row?.tenant_code).toBe('created-venue');
		expect(row?.contact_email).toBe('created@testvenant.com');
	});

	it('returns 400 when name is missing', async () => {
		const res = await exports.default.fetch('http://localhost/api/tenants', {
			method: 'POST',
			headers: adminHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				tenant_code: 'missing-name',
				max_guests: 30,
				max_covers: 10,
				status: 'active',
				concurrent_guests_time_limit: 120,
				contact_email: 'missing-name@testvenant.com',
			}),
		});

		expect(res.status).toBe(400);
	});

	it('returns 400 when tenant_code is missing', async () => {
		const res = await exports.default.fetch('http://localhost/api/tenants', {
			method: 'POST',
			headers: adminHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				name: 'Missing Code Venue',
				max_guests: 30,
				max_covers: 10,
				status: 'active',
				concurrent_guests_time_limit: 120,
				contact_email: 'missing-code@testvenant.com',
			}),
		});

		expect(res.status).toBe(400);
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
