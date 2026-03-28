import { z } from 'zod';
import { Hono } from 'hono';
import { Tenant, UpdateTenantSchema, UpdateTenant, TENANT_UPDATABLE_FIELDS } from '../db/schema';

const tenants = new Hono<{ Bindings: Env }>();

// GET /api/tenants — list all tenants
tenants.get('/', async (c) => {
	const { results } = await c.env.maximum_bookings_db.prepare('SELECT * FROM Tenants').run<Tenant>();
	return c.json(results);
});

// GET /api/tenants/:id — get single tenant
tenants.get('/:id', async (c) => {
	const id = c.req.param('id');
	const tenant = await c.env.maximum_bookings_db.prepare('SELECT * FROM Tenants WHERE id = ?').bind(id).first<Tenant>();

	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
	return c.json(tenant);
});

// POST /api/tenants — create a tenant
tenants.post('/', async (c) => {
	const body = await c.req.json<Omit<Tenant, 'id'>>();
	const id = crypto.randomUUID();

	await c.env.maximum_bookings_db
		.prepare(
			`INSERT INTO Tenants (id, name, max_guests, max_covers, status, block_current_day)
       VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(id, body.name, body.max_guests, body.max_covers, body.status ?? 'active', body.block_current_day ?? false)
		.run();

	return c.json({ id, ...body }, 201);
});

// PATCH /api/tenants/:id — update a tenant
tenants.patch('/:id', async (c) => {
  const parsed = UpdateTenantSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400); // TODO: Add error logging

  const id = c.req.param('id');
	const body = parsed.data;

	// Always bump modified_date
	const updateBody = { ...body, modified_date: new Date().toISOString() };

  const sanitised = Object.fromEntries(Object.entries(updateBody).filter(([k]) => TENANT_UPDATABLE_FIELDS.includes(k as keyof Tenant)));

  if (!Object.keys(sanitised).length) return c.json({ error: 'No valid fields to update' }, 400);

  const fields = Object.keys(sanitised).map((k) => `${k} = ?`).join(', ');
  const values = Object.values(sanitised);

  await c.env.maximum_bookings_db
    .prepare(`UPDATE Tenants SET ${fields} WHERE id = ?`)
    .bind(...values, id)
    .run();

  return c.json({ success: true });
});

// DELETE /api/tenants/:id — delete a tenant (cascades to reservations)
tenants.delete('/:id', async (c) => {
	const id = c.req.param('id');
	await c.env.maximum_bookings_db.prepare('DELETE FROM Tenants WHERE id = ?').bind(id).run();
	return c.json({ success: true });
});

export default tenants;
