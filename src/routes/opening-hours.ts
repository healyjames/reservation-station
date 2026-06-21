import { Hono } from 'hono';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { OpeningHoursEntry, UpsertOpeningHoursSchema } from '../schema';

const openingHours = new Hono<{
	Bindings: Env;
	Variables: {
		userId: string;
		tenantId: string
	}
}>();

openingHours.use('*', adminAuth);

openingHours.get('/', async (c) => {
  const tenantId = c.get('tenantId');

  const { results } = await c.env.maximum_bookings_db
    .prepare('SELECT * FROM OpeningHours WHERE tenant_id = ? ORDER BY day_of_week ASC')
    .bind(tenantId)
    .run<OpeningHoursEntry>();

  return c.json({ success: true, data: results });
});

openingHours.put('/', async (c) => {
  const tenantId = c.get('tenantId');
  const msg = await c.req.json().catch(() => null);
  const parsed = UpsertOpeningHoursSchema.safeParse(msg);
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400);
  }

  const rows = parsed.data;

  for (const entry of rows) {
    const closed = entry.is_closed === true || entry.is_closed === 1;
    if (!closed && (entry.open_time == null || entry.close_time == null)) {
      return c.json({ error: 'open_time and close_time are required when day is not closed' }, 400);
    }
  }

  const normalised = rows.map((entry) => {
    const closed = entry.is_closed === true || entry.is_closed === 1;
    return {
      day_of_week: entry.day_of_week,
      is_closed: closed ? 1 : 0,
      open_time: closed ? null : (entry.open_time ?? null),
      close_time: closed ? null : (entry.close_time ?? null),
    };
  });

  const stmts: D1PreparedStatement[] = [
		c.env.maximum_bookings_db
			.prepare('DELETE FROM OpeningHours WHERE tenant_id = ?')
			.bind(tenantId)
	];

  for (const entry of normalised) {
    stmts.push(
      c.env.maximum_bookings_db
        .prepare(
          'INSERT OR REPLACE INTO OpeningHours (id, tenant_id, day_of_week, is_closed, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(crypto.randomUUID(), tenantId, entry.day_of_week, entry.is_closed, entry.open_time, entry.close_time),
    );
  }

  await c.env.maximum_bookings_db.batch(stmts);

  return c.json({ success: true });
});

export default openingHours;
