import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, signJWT } from '../src/utils/auth';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-4000-8000-000000000301';
const TENANT_ID_OTHER = '00000000-0000-4000-8000-000000000302';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000401';
const RES_ID = '00000000-0000-4000-8000-000000000501';
const RES_ID_OTHER = '00000000-0000-4000-8000-000000000502';

const TEST_EMAIL = 'owner@myvenue.com';
const TEST_PASSWORD = 'securepass456';

// ─── Seed helpers ────────────────────────────────────────────────────────────

async function seedTenant(overrides: Record<string, unknown> = {}) {
	await env.maximum_bookings_db
		.prepare(
			`INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, block_current_day, concurrent_guests_time_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			overrides.id ?? TENANT_ID,
			overrides.name ?? 'My Venue',
			overrides.tenant_code ?? 'myvenue',
			overrides.max_guests ?? 50,
			overrides.max_covers ?? 20,
			overrides.status ?? 'active',
			overrides.block_current_day ?? 0,
			overrides.concurrent_guests_time_limit ?? 120,
		)
		.run();
}

async function seedAdminUser(overrides: Record<string, unknown> = {}) {
	const password = (overrides.password as string) ?? TEST_PASSWORD;
	const password_hash = overrides.password_hash ?? (await hashPassword(password));
	const now = new Date().toISOString();
	await env.maximum_bookings_db
		.prepare(
			`INSERT OR REPLACE INTO AdminUsers (id, tenant_id, email, password_hash, failed_attempts, locked_until, created_date, modified_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			overrides.id ?? ADMIN_USER_ID,
			overrides.tenant_id ?? TENANT_ID,
			overrides.email ?? TEST_EMAIL,
			password_hash,
			overrides.failed_attempts ?? 0,
			overrides.locked_until ?? null,
			now,
			now,
		)
		.run();
}

async function seedReservation(overrides: Record<string, unknown> = {}) {
	const now = new Date().toISOString();
	await env.maximum_bookings_db
		.prepare(
			`INSERT OR REPLACE INTO Reservations
       (id, tenant_id, first_name, surname, telephone, email,
        reservation_date, reservation_time, guests, dietary_requirements,
        created_date, modified_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			overrides.id ?? RES_ID,
			overrides.tenant_id ?? TENANT_ID,
			overrides.first_name ?? 'Alice',
			overrides.surname ?? 'Admin',
			overrides.telephone ?? '07700900001',
			overrides.email ?? 'alice@example.com',
			overrides.reservation_date ?? '2099-06-01',
			overrides.reservation_time ?? '19:00',
			overrides.guests ?? 2,
			overrides.dietary_requirements ?? null,
			now,
			now,
		)
		.run();
}

async function clearDb() {
	await env.maximum_bookings_db.prepare('DELETE FROM AdminUsers').run();
	await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run();
	await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run();
}

async function getAuthToken(email = TEST_EMAIL, password = TEST_PASSWORD): Promise<string> {
	const res = await exports.default.fetch('http://localhost/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	const body = (await res.json()) as any;
	if (!body.token) throw new Error(`Login failed: ${JSON.stringify(body)}`);
	return body.token;
}

// ─── Admin: GET /api/admin/me ─────────────────────────────────────────────────

describe('GET /api/admin/me', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant();
		await seedAdminUser();
	});

	it('returns 401 when no Authorization header is provided', async () => {
		const res = await exports.default.fetch('http://localhost/api/admin/me');
		expect(res.status).toBe(401);
	});

	it('returns 401 when token is invalid', async () => {
		const res = await exports.default.fetch('http://localhost/api/admin/me', {
			headers: { Authorization: 'Bearer this.is.not.a.valid.token' },
		});
		expect(res.status).toBe(401);
	});

	it('returns 401 when token is expired', async () => {
		// signJWT must accept an explicit expiresInSeconds so we can pass -1 to produce an already-expired token
		const expiredToken = await signJWT({ userId: ADMIN_USER_ID, tenantId: TENANT_ID }, (env as any).JWT_SECRET, -1);

		const res = await exports.default.fetch('http://localhost/api/admin/me', {
			headers: { Authorization: `Bearer ${expiredToken}` },
		});
		expect(res.status).toBe(401);
	});

	it('returns 200 with tenant details when token is valid', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch('http://localhost/api/admin/me', {
			headers: { Authorization: `Bearer ${token}` },
		});
		const body = (await res.json()) as any;
		expect(res.status).toBe(200);
		expect(body.id).toBe(TENANT_ID);
		expect(body.name).toBe('My Venue');
		expect(body.tenant_code).toBe('myvenue');
	});
});

// ─── Admin: GET /api/admin/reservations ─────────────────────────────────────

describe('GET /api/admin/reservations', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant({ id: TENANT_ID, name: 'My Venue', tenant_code: 'myvenue' });
		await seedTenant({ id: TENANT_ID_OTHER, name: 'Other Venue', tenant_code: 'othervenue' });
		await seedAdminUser({ tenant_id: TENANT_ID });
		await seedReservation({ id: RES_ID, tenant_id: TENANT_ID, reservation_date: '2099-06-01' });
		await seedReservation({ id: RES_ID_OTHER, tenant_id: TENANT_ID_OTHER, reservation_date: '2099-06-01' });
	});

	it('returns only own tenant bookings for the given date', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch('http://localhost/api/admin/reservations?date=2099-06-01', {
			headers: { Authorization: `Bearer ${token}` },
		});
		const body = (await res.json()) as any[];
		expect(res.status).toBe(200);
		expect(body.every((r: any) => r.tenant_id === TENANT_ID)).toBe(true);
		expect(body.some((r: any) => r.id === RES_ID)).toBe(true);
	});

	it('does not return other tenants bookings — tenant isolation enforced', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch('http://localhost/api/admin/reservations?date=2099-06-01', {
			headers: { Authorization: `Bearer ${token}` },
		});
		const body = (await res.json()) as any[];
		expect(res.status).toBe(200);
		expect(body.some((r: any) => r.id === RES_ID_OTHER)).toBe(false);
		expect(body.some((r: any) => r.tenant_id === TENANT_ID_OTHER)).toBe(false);
	});

	it('returns 401 without a token', async () => {
		const res = await exports.default.fetch('http://localhost/api/admin/reservations?date=2099-06-01');
		expect(res.status).toBe(401);
	});

	// Assumption: omitting date returns all reservations for the tenant (not a 400 error),
	// consistent with the public /api/reservations endpoint behaviour. If the spec changes
	// this to require a date, swap the assertion to toBe(400).
	it('returns 200 with all own-tenant bookings when date param is omitted', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch('http://localhost/api/admin/reservations', {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as any[];
		expect(body.every((r: any) => r.tenant_id === TENANT_ID)).toBe(true);
	});
});

// ─── Admin: PATCH /api/admin/reservations/:id ────────────────────────────────

describe('PATCH /api/admin/reservations/:id', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant({ id: TENANT_ID, name: 'My Venue', tenant_code: 'myvenue' });
		await seedTenant({ id: TENANT_ID_OTHER, name: 'Other Venue', tenant_code: 'othervenue' });
		await seedAdminUser({ tenant_id: TENANT_ID });
		await seedReservation({ id: RES_ID, tenant_id: TENANT_ID });
		await seedReservation({ id: RES_ID_OTHER, tenant_id: TENANT_ID_OTHER });
	});

	it('updates own tenant booking and returns 200', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch(`http://localhost/api/admin/reservations/${RES_ID}`, {
			method: 'PATCH',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ guests: 4, dietary_requirements: 'Vegan' }),
		});
		expect(res.status).toBe(200);

		const row = await env.maximum_bookings_db
			.prepare('SELECT guests, dietary_requirements FROM Reservations WHERE id = ?')
			.bind(RES_ID)
			.first<{ guests: number; dietary_requirements: string }>();
		expect(row?.guests).toBe(4);
		expect(row?.dietary_requirements).toBe('Vegan');
	});

	it('returns 404 when booking belongs to another tenant — resource existence is not revealed', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch(`http://localhost/api/admin/reservations/${RES_ID_OTHER}`, {
			method: 'PATCH',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ guests: 10 }),
		});
		expect(res.status).toBe(404);
	});

	it('returns 401 without a token', async () => {
		const res = await exports.default.fetch(`http://localhost/api/admin/reservations/${RES_ID}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ guests: 3 }),
		});
		expect(res.status).toBe(401);
	});
});

// ─── Admin: DELETE /api/admin/reservations/:id ───────────────────────────────

describe('DELETE /api/admin/reservations/:id', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant({ id: TENANT_ID, name: 'My Venue', tenant_code: 'myvenue' });
		await seedTenant({ id: TENANT_ID_OTHER, name: 'Other Venue', tenant_code: 'othervenue' });
		await seedAdminUser({ tenant_id: TENANT_ID });
		await seedReservation({ id: RES_ID, tenant_id: TENANT_ID });
		await seedReservation({ id: RES_ID_OTHER, tenant_id: TENANT_ID_OTHER });
	});

	it('deletes own tenant booking and returns 200', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch(`http://localhost/api/admin/reservations/${RES_ID}`, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(200);

		const row = await env.maximum_bookings_db
			.prepare('SELECT id FROM Reservations WHERE id = ?')
			.bind(RES_ID)
			.first();
		expect(row).toBeNull();
	});

	it('returns 404 when booking belongs to another tenant — resource existence is not revealed', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch(`http://localhost/api/admin/reservations/${RES_ID_OTHER}`, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(404);

		const row = await env.maximum_bookings_db
			.prepare('SELECT id FROM Reservations WHERE id = ?')
			.bind(RES_ID_OTHER)
			.first();
		expect(row).not.toBeNull();
	});

	it('returns 401 without a token', async () => {
		const res = await exports.default.fetch(`http://localhost/api/admin/reservations/${RES_ID}`, {
			method: 'DELETE',
		});
		expect(res.status).toBe(401);
	});
});

// ─── Admin: PATCH /api/admin/me ──────────────────────────────────────────────

describe('PATCH /api/admin/me', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant();
		await seedAdminUser();
	});

	it('updates allowed tenant settings and returns 200', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch('http://localhost/api/admin/me', {
			method: 'PATCH',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Updated Venue Name', max_covers: 30 }),
		});
		expect(res.status).toBe(200);

		const row = await env.maximum_bookings_db
			.prepare('SELECT name, max_covers FROM Tenants WHERE id = ?')
			.bind(TENANT_ID)
			.first<{ name: string; max_covers: number }>();
		expect(row?.name).toBe('Updated Venue Name');
		expect(row?.max_covers).toBe(30);
	});

	it('ignores id and tenant_id fields in the request body — they are immutable', async () => {
		const token = await getAuthToken();
		const spoofedId = '00000000-0000-4000-8000-999999999999';
		const res = await exports.default.fetch('http://localhost/api/admin/me', {
			method: 'PATCH',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Hacked Name', id: spoofedId, tenant_id: spoofedId }),
		});
		expect(res.status).toBe(200);

		const original = await env.maximum_bookings_db
			.prepare('SELECT id FROM Tenants WHERE id = ?')
			.bind(TENANT_ID)
			.first();
		expect(original).not.toBeNull();

		const spoofed = await env.maximum_bookings_db
			.prepare('SELECT id FROM Tenants WHERE id = ?')
			.bind(spoofedId)
			.first();
		expect(spoofed).toBeNull();
	});

	it('returns 401 without a token', async () => {
		const res = await exports.default.fetch('http://localhost/api/admin/me', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'No Auth' }),
		});
		expect(res.status).toBe(401);
	});
});
