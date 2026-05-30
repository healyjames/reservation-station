import { z } from 'zod';
import { Hono } from 'hono';
import { Reservation, CreateReservationSchema, UpdateReservationSchema, CreateReservation } from '../db/schema';
import { generateTimeSlots, calculateConcurrentGuests, SlotReservation } from '../utils/slots';

const reservations = new Hono<{ Bindings: Env }>();
const yyyyMmDdRegex = /^\d{4}-\d{2}-\d{2}$/;

reservations.get('/blocked-dates', async (c) => {
	const tenantId = c.req.query('tenant_id');
	const month = c.req.query('month');

	if (!tenantId || !month) {
		return c.json({ error: 'tenant_id and month are required' }, 400);
	}

	if (!/^\d{4}-\d{2}$/.test(month)) {
		return c.json({ error: 'month must be in YYYY-MM format' }, 400);
	}

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT id FROM Tenants WHERE id = ?')
		.bind(tenantId)
		.first<{ id: string }>();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { results } = await c.env.maximum_bookings_db
		.prepare('SELECT DISTINCT date FROM BlockedDates WHERE tenant_id = ? AND date LIKE ? AND start_time IS NULL')
		.bind(tenantId, `${month}-%`)
		.run<{ date: string }>();

	const { results: closedDays } = await c.env.maximum_bookings_db
		.prepare('SELECT day_of_week FROM OpeningHours WHERE tenant_id = ? AND is_closed = 1')
		.bind(tenantId)
		.run<{ day_of_week: number }>();

	const blockedSet = new Set(results.map((r) => r.date));

	if (closedDays.length > 0) {
		const closedDowSet = new Set(closedDays.map((r) => r.day_of_week));
		const [year, monthNum] = month.split('-').map(Number);
		const daysInMonth = new Date(year, monthNum, 0).getDate();
		for (let day = 1; day <= daysInMonth; day++) {
			const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
			const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay();
			if (closedDowSet.has(dow)) {
				blockedSet.add(dateStr);
			}
		}
	}

	return c.json({ blocked_dates: Array.from(blockedSet) });
});

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

	const { results: blockedDateRows } = await c.env.maximum_bookings_db
		.prepare('SELECT start_time, end_time FROM BlockedDates WHERE tenant_id = ? AND date = ?')
		.bind(tenantId, date)
		.run<{ start_time: string | null; end_time: string | null }>();

	if (blockedDateRows.some((r) => r.start_time === null)) {
		return c.json({ blocked_times: generateTimeSlots(), time_limit_minutes: tenant.concurrent_guests_time_limit });
	}

	const dow = new Date(date + 'T12:00:00Z').getUTCDay();
	const openingHoursRow = await c.env.maximum_bookings_db
		.prepare('SELECT is_closed, open_time, close_time FROM OpeningHours WHERE tenant_id = ? AND day_of_week = ?')
		.bind(tenantId, dow)
		.first<{ is_closed: number; open_time: string | null; close_time: string | null }>();

	if (openingHoursRow?.is_closed === 1) {
		return c.json({ blocked_times: generateTimeSlots(), time_limit_minutes: tenant.concurrent_guests_time_limit });
	}

	const slots =
		openingHoursRow?.open_time && openingHoursRow?.close_time
			? generateTimeSlots(openingHoursRow.open_time, openingHoursRow.close_time)
			: generateTimeSlots();

	if (tenant.max_guests === 0) {
		const blockedTimes = slots.filter((slot) =>
			blockedDateRows.some((r) => r.start_time !== null && r.end_time !== null && slot >= r.start_time && slot < r.end_time),
		);
		return c.json({ blocked_times: blockedTimes, time_limit_minutes: tenant.concurrent_guests_time_limit });
	}

	const { results: slotReservations } = await c.env.maximum_bookings_db
		.prepare('SELECT reservation_time, guests FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
		.bind(tenantId, date)
		.run<SlotReservation>();

	const blockedTimes: string[] = [];
	for (const slot of slots) {
		const partiallyBlocked = blockedDateRows.some(
			(r) => r.start_time !== null && r.end_time !== null && slot >= r.start_time && slot < r.end_time,
		);
		if (partiallyBlocked) {
			blockedTimes.push(slot);
			continue;
		}
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

reservations.get('/daily-capacity', async (c) => {
	const tenantId = c.req.query('tenant_id');
	const date = c.req.query('date');

	if (!tenantId || !date) {
		return c.json({ error: 'tenant_id and date are required' }, 400);
	}

	if (!yyyyMmDdRegex.test(date)) {
		return c.json({ error: 'date must be in YYYY-MM-DD format' }, 400);
	}

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT max_covers FROM Tenants WHERE id = ?')
		.bind(tenantId)
		.first<{ max_covers: number }>();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	if (tenant.max_covers === 0) {
		return c.json({
			max_covers: 0,
			booked_covers: 0,
			remaining_covers: null,
		});
	}

	const bookingTotals = await c.env.maximum_bookings_db
		.prepare('SELECT COALESCE(SUM(guests), 0) as total FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
		.bind(tenantId, date)
		.first<{ total: number }>();

	const bookedCovers = Number(bookingTotals?.total ?? 0);

	return c.json({
		max_covers: tenant.max_covers,
		booked_covers: bookedCovers,
		remaining_covers: Math.max(0, tenant.max_covers - bookedCovers),
	});
});

reservations.get('/', async (c) => {
	const tenantId = c.req.query('tenant_id');
	const date = c.req.query('date');

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

reservations.get('/:id', async (c) => {
	const id = c.req.param('id');
	const row = await c.env.maximum_bookings_db.prepare('SELECT * FROM Reservations WHERE id = ?').bind(id).first<Reservation>();

	if (!row) return c.json({ error: 'Reservation not found' }, 404);
	return c.json(row);
});

reservations.post('/', async (c) => {
	const msg = await c.req.json().catch(() => null);
	const parsed = CreateReservationSchema.safeParse(msg);
	if (!parsed.success) {
		console.error('[reservations] POST validation failed', { error: z.prettifyError(parsed.error), tenant_id: msg?.tenant_id });
		return c.json({ error: z.prettifyError(parsed.error) }, 400);
	}

	const data: CreateReservation = parsed.data;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	const { results: existing } = await c.env.maximum_bookings_db
		.prepare('SELECT COALESCE(SUM(guests), 0) as total FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
		.bind(data.tenant_id, data.reservation_date)
		.run<{ total: number }>();

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT max_covers FROM Tenants WHERE id = ?')
		.bind(data.tenant_id)
		.first<{ max_covers: number }>();

	if (!tenant) {
		console.error('[reservations] POST tenant not found', { tenant_id: data.tenant_id });
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const fullDayBlock = await c.env.maximum_bookings_db
		.prepare('SELECT id FROM BlockedDates WHERE tenant_id = ? AND date = ? AND start_time IS NULL LIMIT 1')
		.bind(data.tenant_id, data.reservation_date)
		.first<{ id: string }>();

	if (fullDayBlock) {
		return c.json({ error: 'Bookings are not available for this date' }, 422);
	}

	const currentTotal = existing[0]?.total ?? 0;
	if (tenant.max_covers > 0 && currentTotal + data.guests > tenant.max_covers) {
		return c.json({ error: 'Exceeds maximum covers for this date' }, 422);
	}

	try {
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
				data.tenant_id,
				data.first_name,
				data.surname,
				data.telephone,
				data.email,
				data.reservation_date,
				data.reservation_time,
				data.guests,
				data.dietary_requirements ?? null,
				now,
				now,
			)
			.run();
	} catch (err) {
		console.error('[reservations] POST insert failed', { err, tenant_id: data.tenant_id, reservation_id: id });
		return c.json({ error: 'Failed to create reservation' }, 500);
	}

	return c.json({ ...data, id, created_date: now, modified_date: now }, 201);
});

reservations.patch('/:id', async (c) => {
	const id = c.req.param('id');
	const msg = await c.req.json().catch(() => null);
	const parsed = UpdateReservationSchema.safeParse(msg);
	if (!parsed.success) {
		console.error('[reservations] PATCH validation failed', { error: z.prettifyError(parsed.error), id });
		return c.json({ error: z.prettifyError(parsed.error) }, 400);
	}

	const body = parsed.data;
	const data = { ...body, modified_date: new Date().toISOString() };

	if (!Object.keys(data).length) return c.json({ error: 'No valid fields to update' }, 400);

	const fields = Object.keys(data)
		.map((k) => `${k} = ?`)
		.join(', ');
	const values = Object.values(data);

	try {
		await c.env.maximum_bookings_db
			.prepare(`UPDATE Reservations SET ${fields} WHERE id = ?`)
			.bind(...values, id)
			.run();
	} catch (err) {
		console.error('[reservations] PATCH update failed', { err, id });
		return c.json({ error: 'Failed to update reservation' }, 500);
	}

	return c.json({ success: true });
});

reservations.delete('/:id', async (c) => {
	const id = c.req.param('id');

	try {
		const result = await c.env.maximum_bookings_db.prepare('DELETE FROM Reservations WHERE id = ?').bind(id).run();
		if (result.meta.changes === 0) return c.json({ error: 'Reservation not found' }, 404);
	} catch (err) {
		console.error('[reservations] DELETE failed', { err, id });
		return c.json({ error: 'Failed to delete reservation' }, 500);
	}

	return c.json({ success: true });
});

export default reservations;
