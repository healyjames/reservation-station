import { Hono } from 'hono';
import { Reservation } from '../db/schema';

const reservations = new Hono<{ Bindings: Env }>();

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
	const body = await c.req.json<Omit<Reservation, 'id' | 'created_date' | 'modified_date'>>();
	const id = crypto.randomUUID();

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
	const today = new Date().toISOString().split('T')[0];
	if (tenant.block_current_day && body.reservation_date === today) {
		return c.json({ error: 'Same-day bookings are not allowed' }, 422);
	}

	const currentTotal = existing[0]?.total ?? 0;
	if (tenant.max_covers > 0 && currentTotal + body.guests > tenant.max_covers) {
		return c.json({ error: 'Exceeds maximum covers for this date' }, 422);
	}

	await c.env.maximum_bookings_db
		.prepare(
			`INSERT INTO Reservations
        (id, tenant_id, first_name, surname, telephone, email,
         reservation_date, reservation_time, guests, dietary_requirements)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
		)
		.run();

	return c.json({ id, ...body }, 201);
});

// PATCH /api/reservations/:id — update a reservation
reservations.patch('/:id', async (c) => {
	const id = c.req.param('id');
	const body = await c.req.json<Partial<Reservation>>();

	// Always bump modified_date
	const updateBody = { ...body, modified_date: new Date().toISOString() };
	const fields = Object.keys(updateBody)
		.map((k) => `${k} = ?`)
		.join(', ');
	const values = Object.values(updateBody);

	await c.env.maximum_bookings_db
		.prepare(`UPDATE Reservations SET ${fields} WHERE id = ?`)
		.bind(...values, id)
		.run();

	return c.json({ success: true });
});

// DELETE /api/reservations/:id — cancel/delete a reservation
reservations.delete('/:id', async (c) => {
	const id = c.req.param('id');
	await c.env.maximum_bookings_db.prepare('DELETE FROM Reservations WHERE id = ?').bind(id).run();
	return c.json({ success: true });
});

// GET /api/reservations/availability?tenant_id=&date= — check remaining covers
reservations.get('/availability', async (c) => {
	const tenantId = c.req.query('tenant_id');
	const date = c.req.query('date');
	if (!tenantId || !date) return c.json({ error: 'tenant_id and date required' }, 400);

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT max_covers FROM Tenants WHERE id = ?')
		.bind(tenantId)
		.first<{ max_covers: number }>();

	const { results } = await c.env.maximum_bookings_db
		.prepare('SELECT COALESCE(SUM(guests), 0) as total FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
		.bind(tenantId, date)
		.run<{ total: number }>();

	const booked = results[0]?.total ?? 0;
	const remaining = (tenant?.max_covers ?? 0) - booked;

	return c.json({ date, booked, remaining, max_covers: tenant?.max_covers });
});

export default reservations;
