import { z } from 'zod';
import { Hono } from 'hono';
import { Reservation, CreateReservationSchema, UpdateReservationSchema, CreateReservation } from '../db/schema';
import { generateTimeSlots, calculateConcurrentGuests, SlotReservation } from '../utils/slots';

const reservations = new Hono<{ Bindings: Env }>();

// GET /api/reservations/blocked-times?tenant_id=&date=&guests= — check blocked time slots
reservations.get('/blocked-times', async (c) => {
	const tenantId = c.req.query('tenant_id');
	const date = c.req.query('date');
	const guestsParam = c.req.query('guests');

	if (!tenantId || !date || !guestsParam) {
		return c.json({ error: 'tenant_id, date, and guests are required' }, 400);
	}

	const requestedGuests = parseInt(guestsParam, 10);
	if (isNaN(requestedGuests) || requestedGuests <= 0) {
		return c.json({ error: 'guests must be a positive integer' }, 400);
	}

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT max_guests, concurrent_guests_time_limit FROM Tenants WHERE id = ?')
		.bind(tenantId)
		.first<{ max_guests: number; concurrent_guests_time_limit: number }>();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	if (tenant.max_guests === 0) {
		return c.json({ blocked_times: [], time_limit_minutes: tenant.concurrent_guests_time_limit });
	}

	const { results: slotReservations } = await c.env.maximum_bookings_db
		.prepare('SELECT reservation_time, guests FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
		.bind(tenantId, date)
		.run<SlotReservation>();

	const blockedTimes: string[] = [];
	for (const slot of generateTimeSlots()) {
		const concurrent = calculateConcurrentGuests(slot, slotReservations, tenant.concurrent_guests_time_limit);
		if (concurrent + requestedGuests > tenant.max_guests) {
			blockedTimes.push(slot);
		}
	}

	return c.json({
		blocked_times: blockedTimes,
		time_limit_minutes: tenant.concurrent_guests_time_limit,
	});
});

// GET /api/reservations/availability?tenant_id=&date= — per-slot concurrent guest counts
reservations.get('/availability', async (c) => {
	const tenantId = c.req.query('tenant_id');
	const dateParam = c.req.query('date');
	if (!tenantId) return c.json({ error: 'tenant_id required' }, 400);
	if (!dateParam) return c.json({ error: 'date required' }, 400);

	const parsedDate = new Date(dateParam);
	if (isNaN(parsedDate.getTime())) return c.json({ error: 'Invalid date. Expected YYYY-MM-DD' }, 400);
	const date = parsedDate.toISOString().split('T')[0];

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT max_covers, concurrent_guests_time_limit FROM Tenants WHERE id = ?')
		.bind(tenantId)
		.first<{ max_covers: number; concurrent_guests_time_limit: number }>();

	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	const { results: slotReservations } = await c.env.maximum_bookings_db
		.prepare('SELECT reservation_time, guests FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
		.bind(tenantId, date)
		.run<SlotReservation>();

	const slots = generateTimeSlots().map((time) => {
		const concurrent_guests = calculateConcurrentGuests(time, slotReservations, tenant.concurrent_guests_time_limit);
		return {
			time,
			concurrent_guests,
			available_capacity: Math.max(0, tenant.max_covers - concurrent_guests),
		};
	});

	return c.json({
		date,
		max_covers: tenant.max_covers,
		time_limit_minutes: tenant.concurrent_guests_time_limit,
		slots,
	});
});

// GET /api/reservations — list, optionally filter by tenant + date
reservations.get('/', async (c) => {
	const tenantId = c.req.query('tenant_id');
	const date = c.req.query('date'); // YYYY-MM-DD

	let query = 'SELECT * FROM Reservations WHERE 1=1';
	const bindings: string[] = [];

	if (tenantId) {
		query += ' AND tenant_id = ?';
		bindings.push(tenantId);
	}
	if (date) {
		query += ' AND reservation_date = ?';
		bindings.push(date);
	}

	query += ' ORDER BY reservation_date ASC, reservation_time ASC';

	const { results } = await c.env.maximum_bookings_db
		.prepare(query)
		.bind(...bindings)
		.run<Reservation>();

	return c.json(results);
});

// GET /api/reservations/:id — single reservation
reservations.get('/:id', async (c) => {
	const id = c.req.param('id');
	const row = await c.env.maximum_bookings_db.prepare('SELECT * FROM Reservations WHERE id = ?').bind(id).first<Reservation>();

	if (!row) return c.json({ error: 'Reservation not found' }, 404);
	return c.json(row);
});

// POST /api/reservations — create a reservation (with capacity check)
reservations.post('/', async (c) => {
	const parsed = CreateReservationSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400); // TODO: Add error logging

	const body: CreateReservation = parsed.data
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	// Capacity guard — count existing guests on this date for this tenant
	const { results: existing } = await c.env.maximum_bookings_db
		.prepare('SELECT COALESCE(SUM(guests), 0) as total FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
		.bind(body.tenant_id, body.reservation_date)
		.run<{ total: number }>();

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT max_covers, block_current_day FROM Tenants WHERE id = ?')
		.bind(body.tenant_id)
		.first<{ max_covers: number; block_current_day: boolean }>();

	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	// Block same-day bookings if configured
	const today = now.split('T')[0];
	if (tenant.block_current_day && body.reservation_date === today) {
		return c.json({ error: 'Same-day bookings are not allowed', block_current_day: tenant.block_current_day, tenant_id: body.tenant_id }, 422);
	}

	const currentTotal = existing[0]?.total ?? 0;
	if (tenant.max_covers > 0 && currentTotal + body.guests > tenant.max_covers) {
		return c.json({ error: 'Exceeds maximum covers for this date' }, 422);
	}

	await c.env.maximum_bookings_db
		.prepare(
			`INSERT INTO Reservations
        (id, tenant_id, first_name, surname, telephone, email,
         reservation_date, reservation_time, guests, dietary_requirements,
         created_date, modified_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			body.tenant_id,
			body.first_name,
			body.surname,
			body.telephone,
			body.email,
			body.reservation_date,
			body.reservation_time,
			body.guests,
			body.dietary_requirements ?? null,
      now, // created_date
			now, // modified_date
		)
		.run();

  return c.json({ ...body, id, created_date: now, modified_date: now }, 201);

});

// PATCH /api/reservations/:id — update a reservation
reservations.patch('/:id', async (c) => {
	const id = c.req.param('id');
	const parsed = UpdateReservationSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400); // TODO: Add error logging

	const body = parsed.data;

	// Always bump modified_date
	const data = { ...body, modified_date: new Date().toISOString() };

  if (!Object.keys(data).length) return c.json({ error: 'No valid fields to update' }, 400);

  const fields = Object.keys(data)
		.map((k) => `${k} = ?`)
		.join(', ');
	const values = Object.values(data);

	await c.env.maximum_bookings_db
		.prepare(`UPDATE Reservations SET ${fields} WHERE id = ?`)
		.bind(...values, id)
		.run();

	return c.json({ success: true });
});

// DELETE /api/reservations/:id — cancel/delete a reservation
reservations.delete('/:id', async (c) => {
	const id = c.req.param('id');
	const result = await c.env.maximum_bookings_db.prepare('DELETE FROM Reservations WHERE id = ?').bind(id).run();

  if (result.meta.changes === 0) return c.json({ error: 'Reservation not found' }, 404);
	return c.json({ success: true });
});

export default reservations;
