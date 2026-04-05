import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeEach } from 'vitest';

// ─── Seed helpers ────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const TENANT_ID_2 = '00000000-0000-4000-8000-000000000002';
const RES_ID = '00000000-0000-4000-8000-000000000010';

async function seedTenant(overrides: Record<string, unknown> = {}) {
	await env.maximum_bookings_db
		.prepare(
			`INSERT OR REPLACE INTO Tenants (id, name, max_guests, max_covers, status, block_current_day, concurrent_guests_time_limit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			overrides.id ?? TENANT_ID,
			overrides.name ?? 'Test Restaurant',
			overrides.max_guests ?? 50,
			overrides.max_covers ?? 20,
			overrides.status ?? 'active',
			overrides.block_current_day ?? 0,
			overrides.concurrent_guests_time_limit ?? 120,
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
			overrides.first_name ?? 'Jane',
			overrides.surname ?? 'Doe',
			overrides.telephone ?? '07700900000',
			overrides.email ?? 'jane@example.com',
			overrides.reservation_date ?? '2099-06-01', // far future avoids same-day blocks
			overrides.reservation_time ?? '19:00',
			overrides.guests ?? 2,
			overrides.dietary_requirements ?? null,
			now,
			now,
		)
		.run();
}

async function clearDb() {
	await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run();
	await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run();
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

describe('Tenants', () => {
	beforeEach(clearDb);

	// GET /api/tenants
	describe('GET /api/tenants', () => {
		it('returns empty array when no tenants', async () => {
			const res = await exports.default.fetch('http://localhost/api/tenants');
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual([]);
		});

		it('returns all tenants', async () => {
			await seedTenant();
			const res = await exports.default.fetch('http://localhost/api/tenants');
			const body = (await res.json()) as any[];
			expect(res.status).toBe(200);
			expect(body).toHaveLength(1);
			expect(body[0].name).toBe('Test Restaurant');
		});
	});

	// GET /api/tenants/:id
	describe('GET /api/tenants/:id', () => {
		it('returns a tenant by id', async () => {
			await seedTenant();
			const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.id).toBe(TENANT_ID);
		});

		it('returns 404 for unknown id', async () => {
			const res = await exports.default.fetch(`http://localhost/api/tenants/00000000-0000-4000-8000-999999999999`);
			expect(res.status).toBe(404);
		});
	});

	// POST /api/tenants
	describe('POST /api/tenants', () => {
		it('creates a tenant and returns 201 with id', async () => {
			const res = await exports.default.fetch('http://localhost/api/tenants', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'New Place',
					max_guests: 30,
					max_covers: 10,
					status: 'active',
					block_current_day: false,
				}),
			});
			const body = (await res.json()) as any;
			expect(res.status).toBe(201);
			expect(body.id).toBeDefined();
			expect(body.name).toBe('New Place');
			expect(body.created_date).toBeDefined();
		});

		it('rejects invalid payload with 400', async () => {
			const res = await exports.default.fetch('http://localhost/api/tenants', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: '' }), // missing required fields
			});
			expect(res.status).toBe(400);
		});

		it('rejects invalid status enum', async () => {
			const res = await exports.default.fetch('http://localhost/api/tenants', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Bad Status',
					max_guests: 10,
					max_covers: 5,
					status: 'pending', // not in enum
					block_current_day: false,
				}),
			});
			expect(res.status).toBe(400);
		});
	});

	// PATCH /api/tenants/:id
	describe('PATCH /api/tenants/:id', () => {
		it('updates allowed fields', async () => {
			await seedTenant();
			const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Updated Name' }),
			});
			expect(res.status).toBe(200);

			const row = await env.maximum_bookings_db.prepare('SELECT name FROM Tenants WHERE id = ?').bind(TENANT_ID).first<{ name: string }>();
			expect(row?.name).toBe('Updated Name');
		});

		it('bumps modified_date on update', async () => {
			await seedTenant();
			await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Changed' }),
			});
			const row = await env.maximum_bookings_db
				.prepare('SELECT modified_date FROM Tenants WHERE id = ?')
				.bind(TENANT_ID)
				.first<{ modified_date: string }>();
			expect(row?.modified_date).toBeDefined();
		});

		it('returns 400 for empty body', async () => {
			await seedTenant();
			const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(400);
		});
	});

	// DELETE /api/tenants/:id
	describe('DELETE /api/tenants/:id', () => {
		it('deletes a tenant', async () => {
			await seedTenant();
			const res = await exports.default.fetch(`http://localhost/api/tenants/${TENANT_ID}`, { method: 'DELETE' });
			expect(res.status).toBe(200);
			const row = await env.maximum_bookings_db.prepare('SELECT id FROM Tenants WHERE id = ?').bind(TENANT_ID).first();
			expect(row).toBeNull();
		});

		it('returns 404 for unknown tenant', async () => {
			const res = await exports.default.fetch(`http://localhost/api/tenants/00000000-0000-4000-8000-999999999999`, { method: 'DELETE' });
			expect(res.status).toBe(404);
		});
	});
});

// ─── Reservations ─────────────────────────────────────────────────────────────

describe('Reservations', () => {
	beforeEach(async () => {
		await clearDb();
		await seedTenant();
	});

	// GET /api/reservations
	describe('GET /api/reservations', () => {
		it('returns empty array with no reservations', async () => {
			const res = await exports.default.fetch('http://localhost/api/reservations');
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual([]);
		});

		it('returns all reservations', async () => {
			await seedReservation();
			const res = await exports.default.fetch('http://localhost/api/reservations');
			const body = (await res.json()) as any[];
			expect(body).toHaveLength(1);
		});

		it('filters by tenant_id', async () => {
			await seedTenant({ id: TENANT_ID_2, name: 'Other Place' });
			await seedReservation({ id: RES_ID, tenant_id: TENANT_ID });
			await seedReservation({ id: '00000000-0000-4000-8000-000000000011', tenant_id: TENANT_ID_2 });

			const res = await exports.default.fetch(`http://localhost/api/reservations?tenant_id=${TENANT_ID}`);
			const body = (await res.json()) as any[];
			expect(body).toHaveLength(1);
			expect(body[0].tenant_id).toBe(TENANT_ID);
		});

		it('filters by date', async () => {
			await seedReservation({ id: RES_ID, reservation_date: '2099-06-01' });
			await seedReservation({ id: '00000000-0000-4000-8000-000000000011', reservation_date: '2099-07-01' });

			const res = await exports.default.fetch(`http://localhost/api/reservations?date=2099-06-01`);
			const body = (await res.json()) as any[];
			expect(body).toHaveLength(1);
			expect(body[0].reservation_date).toBe('2099-06-01');
		});
	});

	// GET /api/reservations/:id
	describe('GET /api/reservations/:id', () => {
		it('returns a reservation', async () => {
			await seedReservation();
			const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}`);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.id).toBe(RES_ID);
		});

		it('returns 404 for unknown id', async () => {
			const res = await exports.default.fetch(`http://localhost/api/reservations/00000000-0000-4000-8000-999999999999`);
			expect(res.status).toBe(404);
		});
	});

	// POST /api/reservations
	describe('POST /api/reservations', () => {
		const validPayload = {
			tenant_id: TENANT_ID,
			first_name: 'John',
			surname: 'Smith',
			telephone: '07700900001',
			email: 'john@example.com',
			reservation_date: '2099-06-15',
			reservation_time: '20:00',
			guests: 4,
		};

		it('creates a reservation and returns 201', async () => {
			const res = await exports.default.fetch('http://localhost/api/reservations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(validPayload),
			});
			const body = (await res.json()) as any;
			expect(res.status).toBe(201);
			expect(body.id).toBeDefined();
			expect(body.created_date).toBeDefined();
			expect(body.modified_date).toBeDefined();
		});

		it('rejects unknown tenant with 404', async () => {
			const res = await exports.default.fetch('http://localhost/api/reservations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validPayload, tenant_id: '00000000-0000-4000-8000-999999999999' }),
			});
			expect(res.status).toBe(404);
		});

		it('rejects invalid email with 400', async () => {
			const res = await exports.default.fetch('http://localhost/api/reservations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validPayload, email: 'not-an-email' }),
			});
			expect(res.status).toBe(400);
		});

		it('rejects invalid date format with 400', async () => {
			const res = await exports.default.fetch('http://localhost/api/reservations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validPayload, reservation_date: '15/06/2099' }),
			});
			expect(res.status).toBe(400);
		});

		it('blocks same-day booking when tenant has block_current_day=true', async () => {
			await seedTenant({ id: TENANT_ID_2, name: 'No Same Day', block_current_day: 1 });
			const today = new Date().toISOString().split('T')[0];
			const res = await exports.default.fetch('http://localhost/api/reservations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validPayload, tenant_id: TENANT_ID_2, reservation_date: today }),
			});
			expect(res.status).toBe(422);
			const body = (await res.json()) as any;
			expect(body.error).toMatch(/same-day/i);
		});

		it('rejects booking that exceeds max_covers', async () => {
			// Tenant has max_covers=20, seed 18 guests already booked
			await seedReservation({ guests: 18, reservation_date: '2099-06-15' });
			const res = await exports.default.fetch('http://localhost/api/reservations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validPayload, guests: 4 }), // 18+4=22 > 20
			});
			expect(res.status).toBe(422);
			const body = (await res.json()) as any;
			expect(body.error).toMatch(/covers/i);
		});

		it('allows booking when guests fit within remaining covers', async () => {
			await seedReservation({ guests: 15, reservation_date: '2099-06-15' });
			const res = await exports.default.fetch('http://localhost/api/reservations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...validPayload, guests: 4 }), // 15+4=19 <= 20
			});
			expect(res.status).toBe(201);
		});
	});

	// PATCH /api/reservations/:id
	describe('PATCH /api/reservations/:id', () => {
		it('updates allowed fields', async () => {
			await seedReservation();
			const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ first_name: 'Updated', guests: 3 }),
			});
			expect(res.status).toBe(200);

			const row = await env.maximum_bookings_db
				.prepare('SELECT first_name, guests FROM Reservations WHERE id = ?')
				.bind(RES_ID)
				.first<{ first_name: string; guests: number }>();
			expect(row?.first_name).toBe('Updated');
			expect(row?.guests).toBe(3);
		});

		it('bumps modified_date on update', async () => {
			await seedReservation();
			await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ first_name: 'Changed' }),
			});
			const row = await env.maximum_bookings_db
				.prepare('SELECT modified_date FROM Reservations WHERE id = ?')
				.bind(RES_ID)
				.first<{ modified_date: string }>();
			expect(row?.modified_date).toBeDefined();
		});

		it('returns 400 for empty body', async () => {
			await seedReservation();
			const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(400);
		});
	});

	// DELETE /api/reservations/:id
	describe('DELETE /api/reservations/:id', () => {
		it('deletes a reservation', async () => {
			await seedReservation();
			const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}`, { method: 'DELETE' });
			expect(res.status).toBe(200);
			const row = await env.maximum_bookings_db.prepare('SELECT id FROM Reservations WHERE id = ?').bind(RES_ID).first();
			expect(row).toBeNull();
		});

		it('returns 404 for unknown reservation', async () => {
			const res = await exports.default.fetch(`http://localhost/api/reservations/00000000-0000-4000-8000-999999999999`, { method: 'DELETE' });
			expect(res.status).toBe(404);
		});
	});

	// GET /api/reservations/availability
	describe('GET /api/reservations/availability', () => {
		it('returns correct remaining covers', async () => {
			await seedReservation({ guests: 5, reservation_date: '2099-06-01' });
			const res = await exports.default.fetch(`http://localhost/api/reservations/availability?tenant_id=${TENANT_ID}&date=2099-06-01`);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.booked).toBe(5);
			expect(body.remaining).toBe(15); // max_covers=20 - 5
		});

		it('returns 400 when params are missing', async () => {
			const res = await exports.default.fetch(`http://localhost/api/reservations/availability?tenant_id=${TENANT_ID}`);
			expect(res.status).toBe(400);
		});

		it('returns full availability for a date with no bookings', async () => {
			const res = await exports.default.fetch(`http://localhost/api/reservations/availability?tenant_id=${TENANT_ID}&date=2099-12-25`);
			const body = (await res.json()) as any;
			expect(body.booked).toBe(0);
			expect(body.remaining).toBe(20);
		});
	});

	// GET /api/reservations/blocked-times
	describe('GET /api/reservations/blocked-times', () => {
		it('returns 400 when required params are missing', async () => {
			// Missing tenant_id
			let res = await exports.default.fetch(`http://localhost/api/reservations/blocked-times?date=2099-08-01&guests=4`);
			expect(res.status).toBe(400);

			// Missing date
			res = await exports.default.fetch(`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&guests=4`);
			expect(res.status).toBe(400);

			// Missing guests
			res = await exports.default.fetch(`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01`);
			expect(res.status).toBe(400);
		});

		it('returns 404 for unknown tenant', async () => {
			const res = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=00000000-0000-4000-8000-999999999999&date=2099-08-01&guests=4`,
			);
			expect(res.status).toBe(404);
		});

		it('returns empty blocked_times when no reservations exist', async () => {
			await seedTenant({ max_guests: 10, concurrent_guests_time_limit: 120 });
			const res = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=4`,
			);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.blocked_times).toEqual([]);
			expect(body.time_limit_minutes).toBe(120);
		});

		it('returns empty blocked_times when max_guests is 0 (no limit)', async () => {
			await seedTenant({ max_guests: 0, concurrent_guests_time_limit: 120 });
			await seedReservation({ reservation_date: '2099-08-01', reservation_time: '14:00', guests: 10 });
			const res = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=5`,
			);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.blocked_times).toEqual([]);
		});

		it('blocks a slot when concurrent guests would exceed max_guests', async () => {
			await seedTenant({ max_guests: 6, concurrent_guests_time_limit: 120 });
			await seedReservation({ reservation_date: '2099-08-01', reservation_time: '14:00', guests: 5 });
			const res = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=3`,
			);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.blocked_times).toContain('14:00');
		});

		it('does not block a slot when concurrent guests are within limit', async () => {
			await seedTenant({ max_guests: 10, concurrent_guests_time_limit: 120 });
			await seedReservation({ reservation_date: '2099-08-01', reservation_time: '14:00', guests: 3 });
			const res = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=2`,
			);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.blocked_times).toEqual([]);
		});

		it('respects concurrent_guests_time_limit — distant slots are not blocked', async () => {
			await seedTenant({ max_guests: 6, concurrent_guests_time_limit: 60 });
			await seedReservation({ reservation_date: '2099-08-01', reservation_time: '14:00', guests: 5 });
			const res = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=3`,
			);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.blocked_times).toContain('14:00');
			expect(body.blocked_times).not.toContain('12:00');
		});
	});

	// GET /api/reservations/blocked-times — Oak Tavern real-world scenario
	describe('GET /api/reservations/blocked-times — Oak Tavern scenario', () => {
		it('lunch cluster — slots within window are blocked for large groups', async () => {
			await seedTenant({ max_guests: 10, concurrent_guests_time_limit: 120 });
			await seedReservation({ id: RES_ID, reservation_date: '2099-06-15', reservation_time: '13:00', guests: 4 });
			await seedReservation({ id: '00000000-0000-4000-8000-000000000020', reservation_date: '2099-06-15', reservation_time: '13:30', guests: 4 });
			const res = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=3`,
			);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.blocked_times).toContain('13:00'); // 4+4+3=11 > 10
			expect(body.blocked_times).toContain('13:30');
			expect(body.blocked_times).toContain('14:00'); // within 120 min of both bookings: 4+4+3=11 > 10
		});

		it('lunch cluster — slots within window are OK for small groups (1 guest)', async () => {
			await seedTenant({ max_guests: 10, concurrent_guests_time_limit: 120 });
			await seedReservation({ id: RES_ID, reservation_date: '2099-06-15', reservation_time: '13:00', guests: 4 });
			await seedReservation({ id: '00000000-0000-4000-8000-000000000020', reservation_date: '2099-06-15', reservation_time: '13:30', guests: 4 });
			const res = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=1`,
			);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.blocked_times).not.toContain('13:00'); // 4+4+1=9 <= 10
			expect(body.blocked_times).not.toContain('13:30');
		});

		it('evening slots are not affected by lunch cluster', async () => {
			await seedTenant({ max_guests: 10, concurrent_guests_time_limit: 120 });
			await seedReservation({ id: RES_ID, reservation_date: '2099-06-15', reservation_time: '13:00', guests: 4 });
			await seedReservation({ id: '00000000-0000-4000-8000-000000000020', reservation_date: '2099-06-15', reservation_time: '13:30', guests: 4 });
			const res = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=3`,
			);
			const body = (await res.json()) as any;
			expect(res.status).toBe(200);
			expect(body.blocked_times).not.toContain('16:00'); // 180 min from 13:00, 150 min from 13:30 — both ≥ 120
			expect(body.blocked_times).not.toContain('19:00');
			expect(body.blocked_times).not.toContain('20:00');
		});

		it('multiple reservations pushed close to limit — exact boundary', async () => {
			await seedTenant({ max_guests: 10, concurrent_guests_time_limit: 120 });
			await seedReservation({ id: RES_ID, reservation_date: '2099-06-15', reservation_time: '13:00', guests: 4 });
			await seedReservation({ id: '00000000-0000-4000-8000-000000000020', reservation_date: '2099-06-15', reservation_time: '13:30', guests: 3 });
			await seedReservation({ id: '00000000-0000-4000-8000-000000000021', reservation_date: '2099-06-15', reservation_time: '14:00', guests: 2 });
			// 4+3+2=9 concurrent; 9+1=10 which is NOT > 10 — should NOT be blocked
			const resA = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=1`,
			);
			const bodyA = (await resA.json()) as any;
			expect(resA.status).toBe(200);
			expect(bodyA.blocked_times).not.toContain('13:30');
			// 4+3+2=9 concurrent; 9+2=11 > 10 — should be blocked
			const resB = await exports.default.fetch(
				`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=2`,
			);
			const bodyB = (await resB.json()) as any;
			expect(resB.status).toBe(200);
			expect(bodyB.blocked_times).toContain('13:30');
		});
	});
});
