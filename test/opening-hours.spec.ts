import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword } from '../src/utils/auth';

const TENANT_ID = '00000000-0000-4000-8000-000000001001';
const TENANT_ID_OTHER = '00000000-0000-4000-8000-000000001002';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000001101';

const TEST_EMAIL = 'owner@openinghoursvenue.com';
const TEST_PASSWORD = 'openinghourspass999';

async function seedTenant(overrides: Record<string, unknown> = {}) {
	await env.maximum_bookings_db
		.prepare(
			`INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			overrides.id ?? TENANT_ID,
			overrides.name ?? 'Opening Hours Venue',
			overrides.tenant_code ?? 'openinghoursvenue',
			overrides.max_guests ?? 50,
			overrides.max_covers ?? 20,
			overrides.status ?? 'active',
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

async function seedOpeningHours(overrides: Record<string, unknown> = {}) {
	await env.maximum_bookings_db
		.prepare(`INSERT OR REPLACE INTO OpeningHours (id, tenant_id, day_of_week, is_closed, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?)`)
		.bind(
			overrides.id ?? '00000000-0000-4000-8000-000000001200',
			overrides.tenant_id ?? TENANT_ID,
			overrides.day_of_week ?? 0,
			overrides.is_closed ?? 0,
			overrides.open_time ?? '12:00',
			overrides.close_time ?? '22:00',
		)
		.run();
}

async function seedBlockedDate(overrides: Record<string, unknown> = {}) {
	const now = new Date().toISOString();
	await env.maximum_bookings_db
		.prepare(
			`INSERT OR REPLACE INTO BlockedDates (id, tenant_id, date, start_time, end_time, reason, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			overrides.id ?? '00000000-0000-4000-8000-000000001300',
			overrides.tenant_id ?? TENANT_ID,
			overrides.date ?? '2099-01-06',
			overrides.start_time ?? null,
			overrides.end_time ?? null,
			overrides.reason ?? null,
			now,
		)
		.run();
}

async function clearDb() {
	await env.maximum_bookings_db.prepare('DELETE FROM OpeningHours').run().catch(() => {});
	await env.maximum_bookings_db.prepare('DELETE FROM BlockedDates').run().catch(() => {});
	await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run().catch(() => {});
	await env.maximum_bookings_db.prepare('DELETE FROM AdminUsers').run().catch(() => {});
	await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run().catch(() => {});
}

async function getAuthToken(): Promise<string> {
	const res = await exports.default.fetch('http://localhost/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
	});
	const data = (await res.json()) as { token: string };
	return data.token;
}

function makeAllOpenHours() {
	return Array.from({ length: 7 }, (_, i) => ({
		day_of_week: i,
		is_closed: false,
		open_time: '12:00',
		close_time: '22:00',
	}));
}

describe('GET /api/admin/opening-hours', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant();
		await seedAdminUser();
	});

	it('returns 401 without auth token', async () => {
		const res = await exports.default.fetch('http://localhost/api/admin/opening-hours');
		expect(res.status).toBe(401);
	});

	it('returns empty data array when no opening hours configured', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.success).toBe(true);
		expect(body.data).toEqual([]);
	});

	it('returns configured opening hours ordered by day_of_week', async () => {
		await seedOpeningHours({ id: '00000000-0000-4000-8000-000000001202', day_of_week: 2, open_time: '10:00', close_time: '22:00' });
		await seedOpeningHours({ id: '00000000-0000-4000-8000-000000001200', day_of_week: 0, open_time: '12:00', close_time: '22:00' });
		await seedOpeningHours({ id: '00000000-0000-4000-8000-000000001201', day_of_week: 1, open_time: '11:00', close_time: '22:00' });
		const token = await getAuthToken();
		const res = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.success).toBe(true);
		expect(body.data.length).toBe(3);
		expect(body.data[0].day_of_week).toBe(0);
		expect(body.data[1].day_of_week).toBe(1);
		expect(body.data[2].day_of_week).toBe(2);
	});
});

describe('PUT /api/admin/opening-hours', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant();
		await seedAdminUser();
	});

	it('returns 401 without auth token', async () => {
		const res = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(makeAllOpenHours()),
		});
		expect(res.status).toBe(401);
	});

	it('returns 400 when body has fewer than 7 entries', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			method: 'PUT',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(makeAllOpenHours().slice(0, 6)),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when open day is missing open_time', async () => {
		const token = await getAuthToken();
		const hours = makeAllOpenHours();
		const { open_time: _ot, ...dayWithoutOpenTime } = hours[0];
		const body = [dayWithoutOpenTime, ...hours.slice(1)];
		const res = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			method: 'PUT',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when open day is missing close_time', async () => {
		const token = await getAuthToken();
		const hours = makeAllOpenHours();
		const { close_time: _ct, ...dayWithoutCloseTime } = hours[0];
		const body = [dayWithoutCloseTime, ...hours.slice(1)];
		const res = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			method: 'PUT',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		expect(res.status).toBe(400);
	});

	it('saves all 7 days and returns success', async () => {
		const token = await getAuthToken();
		const res = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			method: 'PUT',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(makeAllOpenHours()),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.success).toBe(true);
	});

	it('replaces existing opening hours on second PUT', async () => {
		const token = await getAuthToken();
		await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			method: 'PUT',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(makeAllOpenHours()),
		});
		const secondHours = makeAllOpenHours().map((h) =>
			h.day_of_week === 0 ? { day_of_week: 0, is_closed: true, open_time: null, close_time: null } : h,
		);
		await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			method: 'PUT',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(secondHours),
		});
		const getRes = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			headers: { Authorization: `Bearer ${token}` },
		});
		const getBody = (await getRes.json()) as any;
		const sunday = getBody.data.find((h: any) => h.day_of_week === 0);
		expect(sunday.is_closed).toBe(1);
		expect(sunday.open_time).toBeNull();
		expect(sunday.close_time).toBeNull();
	});

	it('saves closed day with null times', async () => {
		const token = await getAuthToken();
		const hours = makeAllOpenHours().map((h) =>
			h.day_of_week === 3 ? { day_of_week: 3, is_closed: true, open_time: null, close_time: null } : h,
		);
		const res = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			method: 'PUT',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(hours),
		});
		expect(res.status).toBe(200);
		const getRes = await exports.default.fetch('http://localhost/api/admin/opening-hours', {
			headers: { Authorization: `Bearer ${token}` },
		});
		const getBody = (await getRes.json()) as any;
		const wednesday = getBody.data.find((h: any) => h.day_of_week === 3);
		expect(wednesday.is_closed).toBe(1);
		expect(wednesday.open_time).toBeNull();
		expect(wednesday.close_time).toBeNull();
	});
});

describe('GET /api/tenants/:tenant_code with opening hours', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant();
	});

	it('returns opening_hours null when no opening hours configured', async () => {
		const res = await exports.default.fetch('http://localhost/api/tenants/openinghoursvenue');
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.opening_hours).toBeNull();
	});

	it('returns opening_hours array when configured', async () => {
		await seedOpeningHours({ id: '00000000-0000-4000-8000-000000001200', day_of_week: 0 });
		await seedOpeningHours({ id: '00000000-0000-4000-8000-000000001201', day_of_week: 1 });
		const res = await exports.default.fetch('http://localhost/api/tenants/openinghoursvenue');
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(Array.isArray(body.opening_hours)).toBe(true);
		expect(body.opening_hours.length).toBe(2);
	});
});

describe('GET /api/reservations/blocked-dates with closed day_of_week', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant({ id: TENANT_ID });
		await seedTenant({ id: TENANT_ID_OTHER, name: 'Other Venue', tenant_code: 'othervenue' });
	});

	it('returns empty array when no blocks and no closed days', async () => {
		const res = await exports.default.fetch(
			`http://localhost/api/reservations/blocked-dates?tenant_id=${TENANT_ID}&month=2099-01`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.blocked_dates).toEqual([]);
	});

	it('includes dates falling on closed day_of_week', async () => {
		await seedOpeningHours({
			id: '00000000-0000-4000-8000-000000001200',
			day_of_week: 0,
			is_closed: 1,
			open_time: null,
			close_time: null,
		});
		const res = await exports.default.fetch(
			`http://localhost/api/reservations/blocked-dates?tenant_id=${TENANT_ID}&month=2099-01`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.blocked_dates).toContain('2099-01-05');
		expect(body.blocked_dates).toContain('2099-01-12');
		expect(body.blocked_dates).toContain('2099-01-19');
		expect(body.blocked_dates).toContain('2099-01-26');
		expect(body.blocked_dates.length).toBe(4);
	});

	it('unions closed-dow dates with specific blocked dates', async () => {
		await seedOpeningHours({
			id: '00000000-0000-4000-8000-000000001200',
			day_of_week: 0,
			is_closed: 1,
			open_time: null,
			close_time: null,
		});
		await seedBlockedDate({
			id: '00000000-0000-4000-8000-000000001300',
			tenant_id: TENANT_ID,
			date: '2099-01-06',
		});
		const res = await exports.default.fetch(
			`http://localhost/api/reservations/blocked-dates?tenant_id=${TENANT_ID}&month=2099-01`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.blocked_dates).toContain('2099-01-05');
		expect(body.blocked_dates).toContain('2099-01-12');
		expect(body.blocked_dates).toContain('2099-01-19');
		expect(body.blocked_dates).toContain('2099-01-26');
		expect(body.blocked_dates).toContain('2099-01-06');
		expect(body.blocked_dates.length).toBe(5);
	});

	it('does not include closed-dow dates for other tenant', async () => {
		await seedOpeningHours({
			id: '00000000-0000-4000-8000-000000001200',
			tenant_id: TENANT_ID,
			day_of_week: 0,
			is_closed: 1,
			open_time: null,
			close_time: null,
		});
		const res = await exports.default.fetch(
			`http://localhost/api/reservations/blocked-dates?tenant_id=${TENANT_ID_OTHER}&month=2099-01`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.blocked_dates).not.toContain('2099-01-05');
		expect(body.blocked_dates).not.toContain('2099-01-12');
		expect(body.blocked_dates).not.toContain('2099-01-19');
		expect(body.blocked_dates).not.toContain('2099-01-26');
	});
});

describe('GET /api/reservations/blocked-times with opening hours', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant({ id: TENANT_ID, max_guests: 0 });
	});

	it('returns all slots blocked when day is configured as closed', async () => {
		await seedOpeningHours({
			id: '00000000-0000-4000-8000-000000001200',
			day_of_week: 0,
			is_closed: 1,
			open_time: null,
			close_time: null,
		});
		const res = await exports.default.fetch(
			`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-01-05&guests=2`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.blocked_times.length).toBe(20);
		expect(body.blocked_times).toContain('12:00');
		expect(body.blocked_times).toContain('21:30');
	});

	it('returns no extra blocked slots for open day with no reservations', async () => {
		await seedOpeningHours({
			id: '00000000-0000-4000-8000-000000001201',
			day_of_week: 1,
			is_closed: 0,
			open_time: '12:00',
			close_time: '22:00',
		});
		const res = await exports.default.fetch(
			`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-01-06&guests=2`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.blocked_times).toEqual([]);
	});

	it('returns no slots for tenant with no opening hours (backward compat)', async () => {
		const res = await exports.default.fetch(
			`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-01-06&guests=2`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.blocked_times).toEqual([]);
	});
});
