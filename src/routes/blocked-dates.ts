import { Hono } from 'hono';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { BlockedDate, BlockedDateSchema, CreateBlockedDateSchema, CreateBlockedDate } from '../db/schema';

const BlockDateBodySchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
	start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
	end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
	reason: z.string().optional(),
});

const blockedDates = new Hono<{ Bindings: Env; Variables: { userId: string; tenantId: string } }>();

blockedDates.use('*', adminAuth);

blockedDates.get('/', async (c) => {
	const tenantId = c.get('tenantId');
	const date = c.req.query('date');
	const month = c.req.query('month');

	if (!date && !month) {
		return c.json({ error: 'date or month is required' }, 400);
	}

	if (month) {
		if (!/^\d{4}-\d{2}$/.test(month)) {
			return c.json({ error: 'Invalid month format (YYYY-MM)' }, 400);
		}

		const { results } = await c.env.maximum_bookings_db
			.prepare('SELECT * FROM BlockedDates WHERE tenant_id = ? AND date LIKE ?')
			.bind(tenantId, `${month}-%`)
			.run<BlockedDate>();

		return c.json(results);
	}

	const { results } = await c.env.maximum_bookings_db
		.prepare('SELECT * FROM BlockedDates WHERE tenant_id = ? AND date = ?')
		.bind(tenantId, date)
		.run<BlockedDate>();

	return c.json(results);
});

blockedDates.post('/', async (c) => {
	const tenantId = c.get('tenantId');
	const msg = await c.req.json().catch(() => null);
	const parsed = BlockDateBodySchema.safeParse(msg);
	if (!parsed.success) {
		return c.json({ error: z.prettifyError(parsed.error) }, 400);
	}

	const data = parsed.data;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await c.env.maximum_bookings_db
		.prepare('INSERT INTO BlockedDates (id, tenant_id, date, start_time, end_time, reason, created_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
		.bind(id, tenantId, data.date, data.start_time ?? null, data.end_time ?? null, data.reason ?? null, now)
		.run();

	const row = await c.env.maximum_bookings_db
		.prepare('SELECT * FROM BlockedDates WHERE id = ?')
		.bind(id)
		.first<BlockedDate>();

	return c.json(row, 201);
});

blockedDates.delete('/date/:date', async (c) => {
	const tenantId = c.get('tenantId');
	const date = c.req.param('date');

	await c.env.maximum_bookings_db
		.prepare('DELETE FROM BlockedDates WHERE tenant_id = ? AND date = ?')
		.bind(tenantId, date)
		.run();

	return c.json({ success: true });
});

blockedDates.delete('/:id', async (c) => {
	const tenantId = c.get('tenantId');
	const id = c.req.param('id');

	const result = await c.env.maximum_bookings_db
		.prepare('DELETE FROM BlockedDates WHERE id = ? AND tenant_id = ?')
		.bind(id, tenantId)
		.run();

	if (result.meta.changes === 0) {
		return c.json({ error: 'Blocked date not found' }, 404);
	}

	return c.json({ success: true });
});

export default blockedDates;
