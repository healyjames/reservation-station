import { z } from 'zod';
import { Hono } from 'hono';
import { Tenant, UpdateTenantSchema, CreateTenantSchema, CreateTenant } from '../db/schema';

const tenants = new Hono<{ Bindings: Env }>();

tenants.get('/', async (c) => {
	const { results } = await c.env.maximum_bookings_db.prepare('SELECT * FROM Tenants').run<Tenant>();
	return c.json(results);
});

tenants.get('/:id', async (c) => {
	const id = c.req.param('id');
	const tenant = await c.env.maximum_bookings_db.prepare('SELECT * FROM Tenants WHERE tenant_code = ?').bind(id).first<Tenant>();

	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
	return c.json(tenant);
});

tenants.post('/', async (c) => {
	const rawBody = await c.req.json().catch(() => null);
	const parsed = CreateTenantSchema.safeParse(rawBody);
	if (!parsed.success) {
		console.error('[tenants] POST validation failed', { error: z.prettifyError(parsed.error) });
		return c.json({ error: z.prettifyError(parsed.error) }, 400);
	}

	const body: CreateTenant = parsed.data;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	try {
		await c.env.maximum_bookings_db
			.prepare(
				`INSERT INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, block_current_day, created_date, modified_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(id, body.name, body.tenant_code, body.max_guests, body.max_covers, body.status, body.block_current_day, now, now)
			.run();
	} catch (err) {
		console.error('[tenants] POST insert failed', { err, tenant_code: body.tenant_code });
		return c.json({ error: 'Failed to create tenant' }, 500);
	}

	return c.json({ id, ...body, created_date: now, modified_date: now }, 201);
});

tenants.patch('/:id', async (c) => {
	const id = c.req.param('id');
	const rawBody = await c.req.json().catch(() => null);
	const parsed = UpdateTenantSchema.safeParse(rawBody);
	if (!parsed.success) {
		console.error('[tenants] PATCH validation failed', { error: z.prettifyError(parsed.error), id });
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
			.prepare(`UPDATE Tenants SET ${fields} WHERE id = ?`)
			.bind(...values, id)
			.run();
	} catch (err) {
		console.error('[tenants] PATCH update failed', { err, id });
		return c.json({ error: 'Failed to update tenant' }, 500);
	}

	return c.json({ success: true });
});

tenants.delete('/:id', async (c) => {
	const id = c.req.param('id');

	try {
		const result = await c.env.maximum_bookings_db.prepare('DELETE FROM Tenants WHERE id = ?').bind(id).run();
		if (result.meta.changes === 0) return c.json({ error: 'Tenant not found' }, 404);
	} catch (err) {
		console.error('[tenants] DELETE failed', { err, id });
		return c.json({ error: 'Failed to delete tenant' }, 500);
	}

	return c.json({ success: true });
});

export default tenants;
