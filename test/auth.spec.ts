import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword } from '../src/utils/auth';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-4000-8000-000000000101';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000201';
const TEST_EMAIL = 'admin@testvenue.com';
const TEST_PASSWORD = 'testpassword123';

// ─── Seed helpers ────────────────────────────────────────────────────────────

async function seedTenant(overrides: Record<string, unknown> = {}) {
	const now = new Date().toISOString();
	await env.maximum_bookings_db
		.prepare(
			`INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, block_current_day, concurrent_guests_time_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			overrides.id ?? TENANT_ID,
			overrides.name ?? 'Test Venue',
			overrides.tenant_code ?? 'testvenue',
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

async function clearDb() {
	await env.maximum_bookings_db.prepare('DELETE FROM AdminUsers').run();
	await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run();
	await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run();
}

// ─── Auth: POST /api/auth/login ──────────────────────────────────────────────

describe('POST /api/auth/login', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant();
		await seedAdminUser();
	});

	it('returns token and tenant on valid credentials', async () => {
		const res = await exports.default.fetch('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
		});
		const body = (await res.json()) as any;
		expect(res.status).toBe(200);
		expect(typeof body.token).toBe('string');
		expect(body.token.length).toBeGreaterThan(0);
		expect(body.tenant).toBeDefined();
		expect(body.tenant.id).toBe(TENANT_ID);
		expect(body.tenant.name).toBe('Test Venue');
		expect(body.tenant.tenant_code).toBe('testvenue');
	});

	it('returns 401 when password is incorrect', async () => {
		const res = await exports.default.fetch('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: TEST_EMAIL, password: 'wrongpassword' }),
		});
		const body = (await res.json()) as any;
		expect(res.status).toBe(401);
		expect(body.error).toBe('Invalid credentials');
	});

	it('returns 401 for unknown email — same error message as wrong password to avoid enumeration', async () => {
		const res = await exports.default.fetch('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'nobody@nowhere.com', password: TEST_PASSWORD }),
		});
		const body = (await res.json()) as any;
		expect(res.status).toBe(401);
		expect(body.error).toBe('Invalid credentials');
	});

	it('returns 400 when email is missing', async () => {
		const res = await exports.default.fetch('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: TEST_PASSWORD }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when password is missing', async () => {
		const res = await exports.default.fetch('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: TEST_EMAIL }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 429 when account is locked with locked_until in the future', async () => {
		const futureDate = new Date(Date.now() + 15 * 60 * 1000).toISOString();
		await seedAdminUser({
			email: 'locked@testvenue.com',
			failed_attempts: 10,
			locked_until: futureDate,
		});

		const res = await exports.default.fetch('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'locked@testvenue.com', password: TEST_PASSWORD }),
		});
		expect(res.status).toBe(429);
	});

	it('locks the account after 10 consecutive failed login attempts', async () => {
		for (let i = 0; i < 10; i++) {
			await exports.default.fetch('http://localhost/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: TEST_EMAIL, password: 'wrongpassword' }),
			});
		}

		const row = await env.maximum_bookings_db
			.prepare('SELECT failed_attempts, locked_until FROM AdminUsers WHERE email = ?')
			.bind(TEST_EMAIL)
			.first<{ failed_attempts: number; locked_until: string | null }>();

		expect(row?.failed_attempts).toBeGreaterThanOrEqual(10);
		expect(row?.locked_until).not.toBeNull();
		expect(new Date(row!.locked_until!).getTime()).toBeGreaterThan(Date.now());
	});

	it('allows login when lock has expired (locked_until in the past)', async () => {
		const pastDate = new Date(Date.now() - 1000).toISOString();
		await seedAdminUser({
			email: 'expired-lock@testvenue.com',
			failed_attempts: 10,
			locked_until: pastDate,
		});

		const res = await exports.default.fetch('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'expired-lock@testvenue.com', password: TEST_PASSWORD }),
		});
		expect(res.status).toBe(200);
	});

	it('JWT payload contains correct tenantId', async () => {
		const res = await exports.default.fetch('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
		});
		const { token } = (await res.json()) as any;

		// JWTs are not encrypted — decode the payload directly without verifying the signature
		const [, payloadB64] = token.split('.');
		const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

		expect(payload.tenantId).toBe(TENANT_ID);
	});

	it('resets failed_attempts to 0 on successful login', async () => {
		// Simulate prior failed attempts that didn't yet trigger a lock
		await env.maximum_bookings_db
			.prepare('UPDATE AdminUsers SET failed_attempts = 3 WHERE email = ?')
			.bind(TEST_EMAIL)
			.run();

		await exports.default.fetch('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
		});

		const row = await env.maximum_bookings_db
			.prepare('SELECT failed_attempts FROM AdminUsers WHERE email = ?')
			.bind(TEST_EMAIL)
			.first<{ failed_attempts: number }>();

		expect(row?.failed_attempts).toBe(0);
	});
});
