import { z } from 'zod';
import { Hono } from 'hono';
import { Reservation, CreateReservationSchema, UpdateReservationSchema, CreateReservation } from '../db/schema';
import { generateTimeSlots, calculateConcurrentGuests, SlotReservation } from '../utils/slots';
import { sendEmail } from '../utils/email';
import { buildCustomerConfirmationEmail } from '../emails/customer-confirmation';
import { buildCustomerAmendmentEmail } from '../emails/customer-amendment';
import { buildCustomerCancellationEmail } from '../emails/customer-cancellation';
import { buildTenantConfirmationEmail } from '../emails/tenant-confirmation';
import { buildTenantAmendmentEmail } from '../emails/tenant-amendment';
import { buildTenantCancellationEmail } from '../emails/tenant-cancellation';
import { adminAuth } from '../middleware/adminAuth';

type ReservationWithTenant = Reservation & { tenant_name: string; contact_email: string };

const reservations = new Hono<{ Bindings: Env; Variables: { userId: string; tenantId: string } }>();
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
		.prepare('SELECT max_covers, concurrent_guests_time_limit FROM Tenants WHERE id = ?')
		.bind(tenantId)
		.first<{ max_covers: number; concurrent_guests_time_limit: number }>();

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

	if (tenant.max_covers === 0) {
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
		if (concurrent + requestedGuests > tenant.max_covers) {
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

reservations.get('/', adminAuth, async (c) => {
	const tenantId = c.get('tenantId');
	const date = c.req.query('date');

	let query = 'SELECT * FROM Reservations WHERE tenant_id = ?';
	const bindings: string[] = [tenantId];

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
	const email = c.req.query('email');

	if (!email) return c.json({ error: 'Reservation not found' }, 404);

	const row = await c.env.maximum_bookings_db.prepare('SELECT * FROM Reservations WHERE id = ?').bind(id).first<Reservation>();

	if (!row || row.email.toLowerCase() !== email.toLowerCase()) {
		return c.json({ error: 'Reservation not found' }, 404);
	}
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

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT name, max_covers, concurrent_guests_time_limit, contact_email FROM Tenants WHERE id = ?')
		.bind(data.tenant_id)
		.first<{ name: string; max_covers: number; concurrent_guests_time_limit: number; contact_email: string }>();

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

	if (tenant.max_covers > 0) {
		const { results: dayReservations } = await c.env.maximum_bookings_db
			.prepare('SELECT reservation_time, guests FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
			.bind(data.tenant_id, data.reservation_date)
			.run<SlotReservation>();
		const concurrent = calculateConcurrentGuests(
			data.reservation_time,
			dayReservations,
			tenant.concurrent_guests_time_limit,
		);
		if (concurrent + data.guests > tenant.max_covers) {
			return c.json({ error: 'Insufficient capacity for the requested time' }, 422);
		}
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

	c.executionCtx.waitUntil(
		(async () => {
			const from = `"${tenant.name}" <${tenant.contact_email}>`;
			const baseUrl = c.env.PUBLIC_URL ?? `${c.req.raw.headers.get('x-forwarded-proto') ?? 'https'}://${c.req.header('host')}`;
			await Promise.allSettled([
				sendEmail(c.env, {
					to: data.email,
					from,
					...buildCustomerConfirmationEmail({
						tenantName: tenant.name,
						firstName: data.first_name,
						reservationDate: data.reservation_date,
						reservationTime: data.reservation_time,
						guests: data.guests,
						dietaryRequirements: data.dietary_requirements ?? null,
						reservationId: id,
						customerEmail: data.email,
						baseUrl,
					}),
				}),
				sendEmail(c.env, {
					to: tenant.contact_email,
					from,
					...buildTenantConfirmationEmail({
						tenantName: tenant.name,
						reservationId: id,
						firstName: data.first_name,
						surname: data.surname,
						telephone: data.telephone,
						customerEmail: data.email,
						reservationDate: data.reservation_date,
						reservationTime: data.reservation_time,
						guests: data.guests,
						dietaryRequirements: data.dietary_requirements ?? null,
					}),
				}),
			]);
		})(),
	);

	return c.json({ ...data, id, created_date: now, modified_date: now }, 201);
});

reservations.patch('/:id', async (c) => {
	const id = c.req.param('id');
	const email = c.req.query('email');
	const msg = await c.req.json().catch(() => null);
	const parsed = UpdateReservationSchema.safeParse(msg);
	if (!parsed.success) {
		console.error('[reservations] PATCH validation failed', { error: z.prettifyError(parsed.error), id });
		return c.json({ error: z.prettifyError(parsed.error) }, 400);
	}

	const existing = await c.env.maximum_bookings_db
		.prepare('SELECT r.*, t.name AS tenant_name, t.contact_email FROM Reservations r JOIN Tenants t ON t.id = r.tenant_id WHERE r.id = ?')
		.bind(id)
		.first<ReservationWithTenant>();

	if (!existing || !email || existing.email.toLowerCase() !== email.toLowerCase()) {
		return c.json({ error: 'Reservation not found' }, 404);
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

	const updated = await c.env.maximum_bookings_db
		.prepare('SELECT r.*, t.name AS tenant_name, t.contact_email FROM Reservations r JOIN Tenants t ON t.id = r.tenant_id WHERE r.id = ?')
		.bind(id)
		.first<ReservationWithTenant>();

	if (updated) {
		c.executionCtx.waitUntil(
			(async () => {
				const from = `"${updated.tenant_name}" <${updated.contact_email}>`;
				const baseUrl = c.env.PUBLIC_URL ?? `${c.req.raw.headers.get('x-forwarded-proto') ?? 'https'}://${c.req.header('host')}`;
				await Promise.allSettled([
					sendEmail(c.env, {
						to: updated.email,
						from,
						...buildCustomerAmendmentEmail({
							tenantName: updated.tenant_name,
							firstName: updated.first_name,
							reservationDate: updated.reservation_date,
							reservationTime: updated.reservation_time,
							guests: updated.guests,
							dietaryRequirements: updated.dietary_requirements ?? null,
							reservationId: id,
							customerEmail: updated.email,
							baseUrl,
						}),
					}),
					sendEmail(c.env, {
						to: updated.contact_email,
						from,
						...buildTenantAmendmentEmail({
							tenantName: updated.tenant_name,
							reservationId: id,
							firstName: updated.first_name,
							surname: updated.surname,
							telephone: updated.telephone,
							customerEmail: updated.email,
							reservationDate: updated.reservation_date,
							reservationTime: updated.reservation_time,
							guests: updated.guests,
							dietaryRequirements: updated.dietary_requirements ?? null,
						}),
					}),
				]);
			})(),
		);
	}

	return c.json({ success: true });
});

reservations.delete('/:id', async (c) => {
	const id = c.req.param('id');
	const email = c.req.query('email');

	const reservation = await c.env.maximum_bookings_db
		.prepare('SELECT r.*, t.name AS tenant_name, t.contact_email FROM Reservations r JOIN Tenants t ON t.id = r.tenant_id WHERE r.id = ?')
		.bind(id)
		.first<ReservationWithTenant>();

	if (!reservation || !email || reservation.email.toLowerCase() !== email.toLowerCase()) {
		return c.json({ error: 'Reservation not found' }, 404);
	}

	try {
		await c.env.maximum_bookings_db.prepare('DELETE FROM Reservations WHERE id = ?').bind(id).run();
	} catch (err) {
		console.error('[reservations] DELETE failed', { err, id });
		return c.json({ error: 'Failed to delete reservation' }, 500);
	}

	c.executionCtx.waitUntil(
		(async () => {
			const from = `"${reservation.tenant_name}" <${reservation.contact_email}>`;
			await Promise.allSettled([
				sendEmail(c.env, {
					to: reservation.email,
					from,
					...buildCustomerCancellationEmail({
						tenantName: reservation.tenant_name,
						firstName: reservation.first_name,
						reservationDate: reservation.reservation_date,
						reservationTime: reservation.reservation_time,
						guests: reservation.guests,
						dietaryRequirements: reservation.dietary_requirements ?? null,
					}),
				}),
				sendEmail(c.env, {
					to: reservation.contact_email,
					from,
					...buildTenantCancellationEmail({
						tenantName: reservation.tenant_name,
						reservationId: id,
						firstName: reservation.first_name,
						surname: reservation.surname,
						telephone: reservation.telephone,
						customerEmail: reservation.email,
						reservationDate: reservation.reservation_date,
						reservationTime: reservation.reservation_time,
						guests: reservation.guests,
						dietaryRequirements: reservation.dietary_requirements ?? null,
					}),
				}),
			]);
		})(),
	);

	return c.json({ success: true });
});

export default reservations;
