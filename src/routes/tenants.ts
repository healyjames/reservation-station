import { z } from 'zod';
import { Hono } from 'hono';
import { CreateTenantWithAdminSchema, UpdateTenantSchema } from '../schema';
import type { CreateTenantWithAdmin, Tenant } from '../schema';
import { superAdminAuth } from '../middleware/superAdminAuth';
import { hashPassword } from '../utils/auth';

const tenants = new Hono<{ Bindings: Env }>();

const defaultOpeningHours = () =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({
    day_of_week: dayOfWeek,
    is_closed: 1,
    open_time: null,
    close_time: null,
  }));

const normaliseOpeningHours = (openingHours: CreateTenantWithAdmin['opening_hours']) =>
  (openingHours ?? defaultOpeningHours()).map((entry) => {
    const isClosed = entry.is_closed === true || entry.is_closed === 1;

    return {
      day_of_week: entry.day_of_week,
      is_closed: isClosed ? 1 : 0,
      open_time: isClosed ? null : (entry.open_time ?? null),
      close_time: isClosed ? null : (entry.close_time ?? null),
    };
  });

const isUniqueViolation = (err: unknown) => err instanceof Error && err.message.includes('UNIQUE constraint failed');

const isTenantCodeConflict = (err: unknown) =>
  err instanceof Error && (err.message.includes('tenant_code') || err.message.includes('idx_tenants_code'));

const isAdminEmailConflict = (err: unknown) =>
  err instanceof Error && (err.message.includes('AdminUsers.email') || err.message.includes('idx_admin_users_email'));

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
    .prepare(isUuid ? `SELECT ${publicColumns} FROM Tenants WHERE id = ?` : `SELECT ${publicColumns} FROM Tenants WHERE tenant_code = ?`)
    .bind(id)
    .first<Pick<Tenant, 'id' | 'name' | 'tenant_code' | 'max_guests' | 'max_covers' | 'status' | 'concurrent_guests_time_limit'>>();

  if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

  const { results } = await c.env.maximum_bookings_db
    .prepare(
      'SELECT id, tenant_id, day_of_week, is_closed, open_time, close_time FROM OpeningHours WHERE tenant_id = ? ORDER BY day_of_week ASC',
    )
    .bind(tenant.id)
    .run<{ id: string; tenant_id: string; day_of_week: number; is_closed: number; open_time: string | null; close_time: string | null }>();

  return c.json({ ...tenant, opening_hours: results.length > 0 ? results : null }, 200, {
    'Cache-Control': 'public, max-age=3600',
  });
});

tenants.post('/', superAdminAuth, async (c) => {
  const rawBody = await c.req.json().catch(() => null);
  const parsed = CreateTenantWithAdminSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: z.prettifyError(parsed.error) }, 400);
  }

  const body = parsed.data;
  const tenantId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(body.admin.password);
  const openingHours = normaliseOpeningHours(body.opening_hours);
  const db = c.env.maximum_bookings_db;

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit, contact_email, created_date, modified_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          tenantId,
          body.tenant.name,
          body.tenant.tenant_code,
          body.tenant.max_guests,
          body.tenant.max_covers,
          body.tenant.status,
          body.tenant.concurrent_guests_time_limit,
          body.tenant.contact_email,
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO AdminUsers (id, tenant_id, email, password_hash, failed_attempts, locked_until, created_date, modified_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(adminUserId, tenantId, body.admin.email, passwordHash, 0, null, now, now),
      ...openingHours.map((entry) =>
        db
          .prepare(
            `INSERT INTO OpeningHours (id, tenant_id, day_of_week, is_closed, open_time, close_time)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(crypto.randomUUID(), tenantId, entry.day_of_week, entry.is_closed, entry.open_time, entry.close_time),
      ),
    ]);
  } catch (err) {
    if (isUniqueViolation(err) && isTenantCodeConflict(err)) {
      return c.json({ success: false, error: 'A tenant with that tenant_code already exists' }, 409);
    }
    if (isUniqueViolation(err) && isAdminEmailConflict(err)) {
      return c.json({ success: false, error: 'An admin with that email already exists' }, 409);
    }
    console.error('[tenants] POST onboarding failed', { err, tenant_code: body.tenant.tenant_code, admin_email: body.admin.email });
    return c.json({ success: false, error: 'Failed to onboard tenant' }, 500);
  }

  return c.json(
    {
      success: true,
      data: {
        tenant: {
          id: tenantId,
          tenant_code: body.tenant.tenant_code,
          name: body.tenant.name,
        },
        admin: {
          email: body.admin.email,
        },
      },
    },
    201,
  );
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

  if (!Object.keys(body).length) return c.json({ error: 'No valid fields to update' }, 400);

  const data = { ...body, modified_date: new Date().toISOString() };

  const fields = Object.keys(data)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(data);

  try {
    const result = await c.env.maximum_bookings_db
      .prepare(`UPDATE Tenants SET ${fields} WHERE id = ?`)
      .bind(...values, id)
      .run();
    if (result.meta.changes === 0) return c.json({ error: 'Tenant not found' }, 404);
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
