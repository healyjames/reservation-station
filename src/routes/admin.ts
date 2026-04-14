import { Hono } from 'hono';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { Tenant, Reservation, UpdateTenantSchema, UpdateReservationSchema } from '../db/schema';

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

	const existing = await c.env.maximum_bookings_db
		.prepare('SELECT id FROM Reservations WHERE id = ?')
		.bind(id)
		.first<{ id: string }>();

	if (!existing || existing.id !== id) {
		return c.json({ error: 'Reservation not found' }, 404);
	}

	const result = await c.env.maximum_bookings_db
		.prepare('DELETE FROM Reservations WHERE id = ? AND tenant_id = ?')
		.bind(id, tenantId)
		.run();

	if (result.meta.changes === 0) return c.json({ error: 'Reservation not found' }, 404);

	return c.json({ success: true });
});

export default admin;
