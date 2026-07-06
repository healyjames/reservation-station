import { Hono } from 'hono';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { Tenant, Reservation, UpdateTenantSchema, UpdateReservationSchema, CreateAdminReservationSchema } from '../schema';
import { sendEmail } from '../utils/email';
import { buildTenantConfirmationEmail } from '../emails/tenant-confirmation';
import { buildCustomerConfirmationEmail } from '../emails/customer-confirmation';
import { buildCustomerAmendmentEmail } from '../emails/customer-amendment';
import { buildTenantAmendmentEmail } from '../emails/tenant-amendment';
import { buildCustomerCancellationEmail } from '../emails/customer-cancellation';
import { buildTenantCancellationEmail } from '../emails/tenant-cancellation';
import { generateManageToken, hashManageToken } from '../utils/manageToken';
import type { ReservationWithTenant } from '../types';

const admin = new Hono<{
	Bindings: Env;
	Variables: {
		userId: string;
		tenantId: string
	}
}>();

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
  const month = c.req.query('month');

  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return c.json({ error: 'Invalid month format. Expected YYYY-MM' }, 400);
    }
    const { results } = await c.env.maximum_bookings_db
      .prepare('SELECT * FROM Reservations WHERE tenant_id = ? AND reservation_date LIKE ? ORDER BY reservation_date ASC, reservation_time ASC')
      .bind(tenantId, `${month}-%`)
      .run<Reservation>();
    return c.json(results);
  }

  let query = 'SELECT * FROM Reservations WHERE tenant_id = ?';
  const bindings: string[] = [tenantId];

  if (date) {
    query += ' AND reservation_date = ?';
    bindings.push(date);
    query += ' ORDER BY reservation_time ASC';
  } else {
    query += ' ORDER BY reservation_date ASC, reservation_time ASC';
  }

  const { results } = await c.env.maximum_bookings_db
    .prepare(query)
    .bind(...bindings)
    .run<Reservation>();

  return c.json(results);
});

admin.post('/reservations', async (c) => {
  const tenantId = c.get('tenantId');

  const msg = await c.req.json().catch(() => null);
  const parsed = CreateAdminReservationSchema.safeParse(msg);
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400);
  }

  const {
		first_name,
		surname,
		telephone,
		email,
		reservation_date,
		reservation_time,
		guests,
		dietary_requirements
	} = parsed.data;

  const tenant = await c.env.maximum_bookings_db
    .prepare('SELECT name, status, max_guests, max_covers, concurrent_guests_time_limit, contact_email FROM Tenants WHERE id = ?')
    .bind(tenantId)
    .first<({
      name: string;
      status: string;
      max_guests: number;
      max_covers: number;
      concurrent_guests_time_limit: number;
      contact_email: string;
    })>();

  if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

  if (tenant.status !== 'active') {
    return c.json({ error: 'Bookings are not currently available for this tenant' }, 422);
  }

  if (tenant.max_guests > 0 && guests > tenant.max_guests) {
    return c.json({ error: `Maximum party size is ${tenant.max_guests}` }, 422);
  }

  const fullDayBlock = await c.env.maximum_bookings_db
    .prepare('SELECT id FROM BlockedDates WHERE tenant_id = ? AND date = ? AND start_time IS NULL LIMIT 1')
    .bind(tenantId, reservation_date)
    .first<{ id: string }>();
  if (fullDayBlock) {
    return c.json({ error: 'Bookings are not available for this date' }, 422);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const [rH, rM] = reservation_time.split(':');
  const slotMinutes = parseInt(rH, 10) * 60 + parseInt(rM, 10);

  const manageToken = email ? await generateManageToken(c.env.JWT_SECRET, id, email) : null;
  const manageTokenHash = manageToken ? await hashManageToken(manageToken) : null;

  let insertResult: D1Result;
  try {
    insertResult = await c.env.maximum_bookings_db
      .prepare(
        `INSERT INTO Reservations (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements, created_date, modified_date, manage_token_hash)
				 SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
				 WHERE (? = 0) OR (
				   SELECT COALESCE(SUM(guests), 0)
				   FROM Reservations
				   WHERE tenant_id = ?
				     AND reservation_date = ?
				     AND (? - (CAST(SUBSTR(reservation_time, 1, 2) AS INTEGER) * 60 +
				        CAST(SUBSTR(reservation_time, 4, 2) AS INTEGER))) BETWEEN 0 AND ? - 1
				 ) + ? <= ?`,
      )
      .bind(
        id,
        tenantId,
        first_name,
        surname,
        telephone,
        email,
        reservation_date,
        reservation_time,
        guests,
        dietary_requirements ?? '',
        now,
        now,
        manageTokenHash,
        tenant.max_covers,
        tenantId,
        reservation_date,
        slotMinutes,
        tenant.concurrent_guests_time_limit,
        guests,
        tenant.max_covers,
      )
      .run();
  } catch (err) {
    console.error('[admin] POST insert failed', { err, tenant_id: tenantId, reservation_id: id });
    return c.json({ error: 'Failed to create reservation' }, 500);
  }

  if (insertResult.meta.changes === 0) {
    return c.json({ error: 'Insufficient capacity for the requested time' }, 422);
  }

  const baseUrl = c.env.PUBLIC_URL || `${c.req.raw.headers.get('x-forwarded-proto') ?? 'https'}://${c.req.header('host')}`;
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
                  reservationId: id,
                  customerEmail: email,
                  baseUrl,
                  manageToken: manageToken ?? undefined,
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

  if (body.email && body.email.toLowerCase() !== (existing.email ?? '').toLowerCase()) {
    const newToken = await generateManageToken(c.env.JWT_SECRET, id, body.email);
    const newHash = await hashManageToken(newToken);
    await c.env.maximum_bookings_db.prepare('UPDATE Reservations SET manage_token_hash = ? WHERE id = ?').bind(newHash, id).run();
  }

  const updated = await c.env.maximum_bookings_db
    .prepare('SELECT r.*, t.name AS tenant_name, t.contact_email FROM Reservations r JOIN Tenants t ON t.id = r.tenant_id WHERE r.id = ?')
    .bind(id)
    .first<ReservationWithTenant>();

  if (updated) {
    c.executionCtx.waitUntil(
      (async () => {
        const from = `"${updated.tenant_name} via Maximum Bookings" <${updated.contact_email}>`;
        const replyTo = updated.contact_email;
        const baseUrl = c.env.PUBLIC_URL ?? `${c.req.raw.headers.get('x-forwarded-proto') ?? 'https'}://${c.req.header('host')}`;
        const emailsToSend = [
          sendEmail(c.env, {
            to: updated.contact_email,
            from,
            reply_to: replyTo,
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
        ];
        if (updated.email) {
          const amendManageToken = await generateManageToken(c.env.JWT_SECRET, id, updated.email);
          emailsToSend.push(
            sendEmail(c.env, {
              to: updated.email,
              from,
              reply_to: replyTo,
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
                manageToken: amendManageToken,
              }),
            }),
          );
        }
        const results = await Promise.allSettled(emailsToSend);
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.error(`[email] send failed (index ${i}):`, r.reason);
          }
        });
      })(),
    );
  }

  return c.json({ success: true });
});

admin.delete('/reservations/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const reservation = await c.env.maximum_bookings_db
    .prepare('SELECT r.*, t.name AS tenant_name, t.contact_email FROM Reservations r JOIN Tenants t ON t.id = r.tenant_id WHERE r.id = ? AND r.tenant_id = ?')
    .bind(id, tenantId)
    .first<ReservationWithTenant>();

  if (!reservation) return c.json({ error: 'Reservation not found' }, 404);

  const result = await c.env.maximum_bookings_db
    .prepare('DELETE FROM Reservations WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .run();

  if (result.meta.changes === 0) return c.json({ error: 'Reservation not found' }, 404);

  c.executionCtx.waitUntil(
    (async () => {
      const from = `"${reservation.tenant_name} via Maximum Bookings" <${reservation.contact_email}>`;
      const replyTo = reservation.contact_email;
      const emailsToSend = [
        sendEmail(c.env, {
          to: reservation.contact_email,
          from,
          reply_to: replyTo,
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
      ];
      if (reservation.email) {
        emailsToSend.push(
          sendEmail(c.env, {
            to: reservation.email,
            from,
            reply_to: replyTo,
            ...buildCustomerCancellationEmail({
              tenantName: reservation.tenant_name,
              firstName: reservation.first_name,
              reservationDate: reservation.reservation_date,
              reservationTime: reservation.reservation_time,
              guests: reservation.guests,
              dietaryRequirements: reservation.dietary_requirements ?? null,
            }),
          }),
        );
      }
      const results = await Promise.allSettled(emailsToSend);
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[email] send failed (index ${i}):`, r.reason);
        }
      });
    })(),
  );

  return c.json({ success: true });
});

export default admin;
