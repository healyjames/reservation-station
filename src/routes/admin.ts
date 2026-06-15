import { Hono } from 'hono';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { Tenant, Reservation, UpdateTenantSchema, UpdateReservationSchema } from '../db/schema';
import { sendEmail } from '../utils/email';
import { buildTenantConfirmationEmail } from '../emails/tenant-confirmation';
import { buildCustomerConfirmationEmail } from '../emails/customer-confirmation';

const admin = new Hono<{ Bindings: Env; Variables: { userId: string; tenantId: string } }>();

admin.use('*', adminAuth);

admin.get('/me', async (c) => {
	const tenantId = c.get('tenantId');
	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT * FROM Tenants WHERE id = ?')
		.bind(tenantId)
		.first<Tenant>();

	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
	return c.json(tenant);
});

admin.patch('/me', async (c) => {
	const tenantId = c.get('tenantId');
	const msg = await c.req.json().catch(() => null);
	const parsed = UpdateTenantSchema.safeParse(msg);
	if (!parsed.success) {
		return c.json({ error: z.prettifyError(parsed.error) }, 400);
	}

	// Strip immutable fields that may have slipped through (tenant_code is in UpdateTenantSchema)
	const { tenant_code: _tc, ...rest } = parsed.data as typeof parsed.data & { tenant_code?: string };
	const data = { ...rest, modified_date: new Date().toISOString() };

	const updatableKeys = Object.keys(data).filter((k) => k !== 'modified_date');
	if (updatableKeys.length === 0) return c.json({ error: 'No valid fields to update' }, 400);

	const fields = Object.keys(data)
		.map((k) => `${k} = ?`)
		.join(', ');
	const values = Object.values(data);

	await c.env.maximum_bookings_db
		.prepare(`UPDATE Tenants SET ${fields} WHERE id = ?`)
		.bind(...values, tenantId)
		.run();

	return c.json({ success: true });
});

admin.get('/reservations', async (c) => {
	const tenantId = c.get('tenantId');
	const date = c.req.query('date');

	let query = 'SELECT * FROM Reservations WHERE tenant_id = ?';
	const bindings: string[] = [tenantId];

	if (date) {
		query += ' AND reservation_date = ?';
		bindings.push(date);
	}

	query += ' ORDER BY reservation_time ASC';

	const { results } = await c.env.maximum_bookings_db
		.prepare(query)
		.bind(...bindings)
		.run<Reservation>();

	return c.json(results);
});

admin.post('/reservations', async (c) => {
	const tenantId = c.get('tenantId');

	const CreateAdminReservationSchema = z.object({
		first_name: z.string().min(1).max(50),
		surname: z.string().min(1).max(50),
		telephone: z.string().optional().default(''),
		email: z.string().optional().default(''),
		reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		reservation_time: z.string().regex(/^\d{2}:\d{2}$/),
		guests: z.number().int().positive(),
		dietary_requirements: z.string().max(500).optional().default(''),
	});

	const msg = await c.req.json().catch(() => null);
	const parsed = CreateAdminReservationSchema.safeParse(msg);
	if (!parsed.success) {
		return c.json({ error: z.prettifyError(parsed.error) }, 400);
	}

	const { first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements } = parsed.data;

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT name, contact_email FROM Tenants WHERE id = ?')
		.bind(tenantId)
		.first<{ name: string; contact_email: string }>();

	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await c.env.maximum_bookings_db
		.prepare(
			`INSERT INTO Reservations (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements, created_date, modified_date)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(id, tenantId, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements ?? '', now, now)
		.run();

	const from = `"${tenant.name} via Maximum Bookings" <${tenant.contact_email}>`;
	const replyTo = tenant.contact_email;

	c.executionCtx.waitUntil(
		(async () => {
			const emailsToSend = [
				sendEmail(c.env, {
					to: tenant.contact_email,
					from,
					reply_to: replyTo,
					...buildTenantConfirmationEmail({
						tenantName: tenant.name,
						reservationId: id,
						firstName: first_name,
						surname,
						telephone,
						customerEmail: email,
						reservationDate: reservation_date,
						reservationTime: reservation_time,
						guests,
						dietaryRequirements: dietary_requirements || null,
					}),
				}),
				...(email
					? [
							sendEmail(c.env, {
								to: email,
								from,
								reply_to: replyTo,
								...buildCustomerConfirmationEmail({
									tenantName: tenant.name,
									firstName: first_name,
									reservationDate: reservation_date,
									reservationTime: reservation_time,
									guests,
									dietaryRequirements: dietary_requirements || null,
									manageToken: undefined,
									baseUrl: undefined,
								}),
							}),
					  ]
					: []),
			];
			const results = await Promise.allSettled(emailsToSend);
			results.forEach((r, i) => {
				if (r.status === 'rejected') {
					console.error(`[email] send failed (index ${i}):`, r.reason);
				}
			});
		})(),
	);

	return c.json({ id }, 201);
});

admin.patch('/reservations/:id', async (c) => {
	const tenantId = c.get('tenantId');
	const id = c.req.param('id');

	const existing = await c.env.maximum_bookings_db
		.prepare('SELECT * FROM Reservations WHERE id = ?')
		.bind(id)
		.first<Reservation>();

	if (!existing || existing.tenant_id !== tenantId) {
		return c.json({ error: 'Reservation not found' }, 404);
	}

	const msg = await c.req.json().catch(() => null);
	const parsed = UpdateReservationSchema.safeParse(msg);
	if (!parsed.success) {
		return c.json({ error: z.prettifyError(parsed.error) }, 400);
	}

	const body = parsed.data;
	if (Object.keys(body).length === 0) return c.json({ error: 'No valid fields to update' }, 400);

	const data = { ...body, modified_date: new Date().toISOString() };

	const fields = Object.keys(data)
		.map((k) => `${k} = ?`)
		.join(', ');
	const values = Object.values(data);

	await c.env.maximum_bookings_db
		.prepare(`UPDATE Reservations SET ${fields} WHERE id = ? AND tenant_id = ?`)
		.bind(...values, id, tenantId)
		.run();

	return c.json({ success: true });
});

admin.delete('/reservations/:id', async (c) => {
	const tenantId = c.get('tenantId');
	const id = c.req.param('id');

	const result = await c.env.maximum_bookings_db
		.prepare('DELETE FROM Reservations WHERE id = ? AND tenant_id = ?')
		.bind(id, tenantId)
		.run();

	if (result.meta.changes === 0) return c.json({ error: 'Reservation not found' }, 404);

	return c.json({ success: true });
});

export default admin;
