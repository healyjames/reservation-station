import { Hono } from 'hono';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { DateOverride, OverrideDateSchema, UpsertDateOverrideSchema } from '../schema';

const dateOverrides = new Hono<{
  Bindings: Env;
  Variables: {
    userId: string;
    tenantId: string;
  };
}>();

dateOverrides.use('*', adminAuth);

dateOverrides.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const month = c.req.query('month');

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: 'month is required (YYYY-MM)' }, 400);
  }

  const { results } = await c.env.maximum_bookings_db
    .prepare('SELECT * FROM DateOverrides WHERE tenant_id = ? AND date LIKE ? ORDER BY date ASC')
    .bind(tenantId, `${month}-%`)
    .run<DateOverride>();

  return c.json({ success: true, data: results });
});

dateOverrides.put('/:date', async (c) => {
  const tenantId = c.get('tenantId');
  const date = OverrideDateSchema.safeParse(c.req.param('date'));
  if (!date.success) return c.json({ error: z.prettifyError(date.error) }, 400);

  const msg = await c.req.json().catch(() => null);
  const parsed = UpsertDateOverrideSchema.safeParse(msg);
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);

  const isClosed = parsed.data.is_closed === true || parsed.data.is_closed === 1;

  // One override per tenant per date: saving again replaces the hours and keeps the row.
  await c.env.maximum_bookings_db
    .prepare(
      `INSERT INTO DateOverrides (id, tenant_id, date, is_closed, open_time, close_time, reason, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (tenant_id, date) DO UPDATE SET
         is_closed = excluded.is_closed,
         open_time = excluded.open_time,
         close_time = excluded.close_time,
         reason = excluded.reason`,
    )
    .bind(
      crypto.randomUUID(),
      tenantId,
      date.data,
      isClosed ? 1 : 0,
      isClosed ? null : (parsed.data.open_time ?? null),
      isClosed ? null : (parsed.data.close_time ?? null),
      parsed.data.reason || null,
      new Date().toISOString(),
    )
    .run();

  const row = await c.env.maximum_bookings_db
    .prepare('SELECT * FROM DateOverrides WHERE tenant_id = ? AND date = ?')
    .bind(tenantId, date.data)
    .first<DateOverride>();

  return c.json({ success: true, data: row });
});

dateOverrides.delete('/:date', async (c) => {
  const tenantId = c.get('tenantId');
  const date = OverrideDateSchema.safeParse(c.req.param('date'));
  if (!date.success) return c.json({ error: z.prettifyError(date.error) }, 400);

  const result = await c.env.maximum_bookings_db
    .prepare('DELETE FROM DateOverrides WHERE tenant_id = ? AND date = ?')
    .bind(tenantId, date.data)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'No special hours found for this date' }, 404);
  }

  return c.json({ success: true });
});

export default dateOverrides;
