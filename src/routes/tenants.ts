import { z } from 'zod';
import { Hono } from 'hono';
import { Tenant, UpdateTenantSchema, CreateTenantSchema, CreateTenant } from '../db/schema';
import { superAdminAuth } from '../middleware/superAdminAuth';

const tenants = new Hono<{ Bindings: Env }>();

tenants.get('/', superAdminAuth, async (c) => {
	const { results } = await c.env.maximum_bookings_db.prepare('SELECT * FROM Tenants').run<Tenant>();
	return c.json(results);
});

tenants.get('/:id', async (c) => {
	const id = c.req.param('id');
	const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

	// Explicit column list — contact_email, created_date, modified_date are intentionally excluded
	// to avoid leaking PII to unauthenticated callers. Use GET /api/admin/me for admin access.
	const publicColumns = 'id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit';
	const tenant = await c.env.maximum_bookings_db
		.prepare(
			isUuid
				? `SELECT ${publicColumns} FROM Tenants WHERE id = ?`
				: `SELECT ${publicColumns} FROM Tenants WHERE tenant_code = ?`,
		)
		.bind(id)
		.first<Pick<Tenant, 'id' | 'name' | 'tenant_code' | 'max_guests' | 'max_covers' | 'status' | 'concurrent_guests_time_limit'>>();

	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	const { results } = await c.env.maximum_bookings_db
		.prepare(
			'SELECT id, tenant_id, day_of_week, is_closed, open_time, close_time FROM OpeningHours WHERE tenant_id = ? ORDER BY day_of_week ASC',
		)
		.bind(tenant.id)
		.run<{ id: string; tenant_id: string; day_of_week: number; is_closed: number; open_time: string | null; close_time: string | null }>();

	return c.json({ ...tenant, opening_hours: results.length > 0 ? results : null });
});

tenants.post('/', superAdminAuth, async (c) => {
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
				`INSERT INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, created_date, modified_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(id, body.name, body.tenant_code, body.max_guests, body.max_covers, body.status, now, now)
			.run();
	} catch (err) {
		if ((err as Error).message?.includes('UNIQUE constraint failed')) {
			return c.json({ error: 'A tenant with that tenant_code already exists' }, 409);
		}
		console.error('[tenants] POST insert failed', { err, tenant_code: body.tenant_code });
		return c.json({ error: 'Failed to create tenant' }, 500);
	}

	return c.json({ id, ...body, created_date: now, modified_date: now }, 201);
});

tenants.patch('/:id', superAdminAuth, async (c) => {
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
		if ((err as Error).message?.includes('UNIQUE constraint failed')) {
			return c.json({ error: 'A tenant with that tenant_code already exists' }, 409);
		}
		console.error('[tenants] PATCH update failed', { err, id });
		return c.json({ error: 'Failed to update tenant' }, 500);
	}

	return c.json({ success: true });
});

tenants.delete('/:id', superAdminAuth, async (c) => {
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
