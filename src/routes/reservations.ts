import { z } from 'zod';
import { Hono } from 'hono';
import {
	Reservation,
	CreateReservationSchema,
	UpdateReservationSchema,
	CreateReservation
} from '../schema';
import {
	toMinutes,
} from '../utils/slots';
import {
	generateManageToken,
	hashManageToken,
	verifyManageToken
} from '../utils/manageToken';
import { sendEmail } from '../utils/email';
import { adminAuth } from '../middleware/adminAuth';
import type { ReservationWithTenant } from '../types';

import { buildCustomerConfirmationEmail } from '../emails/customer-confirmation';
import { buildCustomerAmendmentEmail } from '../emails/customer-amendment';
import { buildCustomerCancellationEmail } from '../emails/customer-cancellation';
import { buildTenantConfirmationEmail } from '../emails/tenant-confirmation';
import { buildTenantAmendmentEmail } from '../emails/tenant-amendment';
import { buildTenantCancellationEmail } from '../emails/tenant-cancellation';

const reservations = new Hono<{
	Bindings: Env;
	Variables: {
		userId: string;
		tenantId: string
	}
}>();

reservations.get('/', adminAuth, async (c) => {
  const tenantId = c.get('tenantId');
  const date = c.req.query('date');

  let query = 'SELECT * FROM Reservations WHERE tenant_id = ?';
  const bindings: string[] = [tenantId];

  if (date) {
    query += ' AND reservation_date = ?';
    bindings.push(date);
  }

  query += ' ORDER BY reservation_date ASC, reservation_time ASC';

  const { results } = await c.env.maximum_bookings_db
    .prepare(query)
    .bind(...bindings)
    .run<Reservation>();

  return c.json(results);
});

reservations.get('/:id', async (c) => {
  const id = c.req.param('id');
  const email = c.req.query('email');

  if (!email) return c.json({ error: 'Reservation not found' }, 404);

  const row = await c.env.maximum_bookings_db
    .prepare('SELECT * FROM Reservations WHERE id = ?')
    .bind(id)
    .first<Reservation & { manage_token_hash?: string | null }>();

  if (!row || row.email.toLowerCase() !== email.toLowerCase()) {
    return c.json({ error: 'Reservation not found' }, 404);
  }
  const { manage_token_hash: _hash, ...safeRow } = row;
  return c.json(safeRow);
});

reservations.post('/', async (c) => {
  const msg = await c.req.json().catch(() => null);
  const parsed = CreateReservationSchema.safeParse(msg);
  if (!parsed.success) {
    console.error('[reservations] POST validation failed', { error: z.prettifyError(parsed.error), tenant_id: msg?.tenant_id });
    return c.json({ error: z.prettifyError(parsed.error) }, 400);
  }

  const data: CreateReservation = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const tenant = await c.env.maximum_bookings_db
    .prepare('SELECT name, status, max_guests, max_covers, concurrent_guests_time_limit, contact_email FROM Tenants WHERE id = ?')
    .bind(data.tenant_id)
    .first<{
      name: string;
      status: string;
      max_guests: number;
      max_covers: number;
      concurrent_guests_time_limit: number;
      contact_email: string;
    }>();

  if (!tenant) {
    console.error('[reservations] POST tenant not found', { tenant_id: data.tenant_id });
    return c.json({ error: 'Tenant not found' }, 404);
  }

  if (tenant.status !== 'active') {
    return c.json({ error: 'Bookings are not currently available' }, 422);
  }

  if (tenant.max_guests > 0 && data.guests > tenant.max_guests) {
    return c.json({ error: `Maximum party size is ${tenant.max_guests}` }, 422);
  }

  const fullDayBlock = await c.env.maximum_bookings_db
    .prepare('SELECT id FROM BlockedDates WHERE tenant_id = ? AND date = ? AND start_time IS NULL LIMIT 1')
    .bind(data.tenant_id, data.reservation_date)
    .first<{ id: string }>();

  if (fullDayBlock) {
    return c.json({ error: 'Bookings are not available for this date' }, 422);
  }

  const { results: partialBlocks } = await c.env.maximum_bookings_db
    .prepare('SELECT start_time, end_time FROM BlockedDates WHERE tenant_id = ? AND date = ? AND start_time IS NOT NULL AND end_time IS NOT NULL')
    .bind(data.tenant_id, data.reservation_date)
    .run<{ start_time: string; end_time: string }>();

  if (partialBlocks.length > 0) {
    const reqMin = toMinutes(data.reservation_time);
    const isBlocked = partialBlocks.some((r) => {
      const a = toMinutes(r.start_time);
      const b = toMinutes(r.end_time);
      return b <= a ? reqMin >= a || reqMin < b : reqMin >= a && reqMin < b;
    });
    if (isBlocked) {
      return c.json({ error: 'Bookings are not available for this time' }, 422);
    }
  }

  const dow = new Date(data.reservation_date + 'T12:00:00Z').getUTCDay();
  const openingHours = await c.env.maximum_bookings_db
    .prepare('SELECT is_closed, open_time, close_time FROM OpeningHours WHERE tenant_id = ? AND day_of_week = ?')
    .bind(data.tenant_id, dow)
    .first<{ is_closed: number; open_time: string | null; close_time: string | null }>();

  if (openingHours) {
    if (openingHours.is_closed === 1) {
      return c.json({ error: 'Bookings are not available for this date' }, 422);
    }
    if (openingHours.open_time && openingHours.close_time) {
      const reqMin = toMinutes(data.reservation_time);
      const openMin = toMinutes(openingHours.open_time);
      const closeMin = toMinutes(openingHours.close_time);
      // Handle midnight-crossing hours (e.g. open 22:00, close 02:00)
      const outsideHours =
        closeMin <= openMin
          ? reqMin < openMin && reqMin >= closeMin // midnight-crossing: reject the gap
          : reqMin < openMin || reqMin >= closeMin; // normal hours
      if (outsideHours) {
        return c.json({ error: 'Bookings are not available for this time' }, 422);
      }
    }
  }

  // Atomic capacity check + insert. The WHERE clause re-evaluates concurrent occupancy
  // inside the same SQLite statement, eliminating the SELECT-then-INSERT race condition.
  // (? = 0) short-circuits for unlimited venues (max_covers = 0).
  // If capacity is exceeded the INSERT matches no row; meta.changes === 0 → 422.
  const [rH, rM] = data.reservation_time.split(':');
  const slotMinutes = parseInt(rH, 10) * 60 + parseInt(rM, 10);

  const manageToken = await generateManageToken(c.env.JWT_SECRET, id, data.email);
  const manageTokenHash = await hashManageToken(manageToken);

  let insertResult: D1Result;
  try {
    insertResult = await c.env.maximum_bookings_db
      .prepare(
        `INSERT INTO Reservations
        (id, tenant_id, first_name, surname, telephone, email,
         reservation_date, reservation_time, guests, dietary_requirements,
         created_date, modified_date, manage_token_hash)
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
        data.tenant_id,
        data.first_name,
        data.surname,
        data.telephone,
        data.email,
        data.reservation_date,
        data.reservation_time,
        data.guests,
        data.dietary_requirements ?? null,
        now,
        now,
        manageTokenHash,
        tenant.max_covers,
        data.tenant_id,
        data.reservation_date,
        slotMinutes,
        tenant.concurrent_guests_time_limit,
        data.guests,
        tenant.max_covers,
      )
      .run();
  } catch (err) {
    if ((err as Error).message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'A reservation for this email, date, and time already exists' }, 409);
    }
    console.error('[reservations] POST insert failed', { err, tenant_id: data.tenant_id, reservation_id: id });
    return c.json({ error: 'Failed to create reservation' }, 500);
  }

  if (insertResult.meta.changes === 0) {
    return c.json({ error: 'Insufficient capacity for the requested time' }, 422);
  }

  const baseUrl = c.env.PUBLIC_URL || `${c.req.raw.headers.get('x-forwarded-proto') ?? 'https'}://${c.req.header('host')}`;

  c.executionCtx.waitUntil(
    (async () => {
      const from = `"${tenant.name} via Maximum Bookings" <${tenant.contact_email}>`;
      const replyTo = tenant.contact_email;
      const results = await Promise.allSettled([
        sendEmail(c.env, {
          to: data.email,
          from,
          reply_to: replyTo,
          ...buildCustomerConfirmationEmail({
            tenantName: tenant.name,
            firstName: data.first_name,
            reservationDate: data.reservation_date,
            reservationTime: data.reservation_time,
            guests: data.guests,
            dietaryRequirements: data.dietary_requirements ?? null,
            reservationId: id,
            customerEmail: data.email,
            baseUrl,
            manageToken,
          }),
        }),
        sendEmail(c.env, {
          to: tenant.contact_email,
          from,
          reply_to: replyTo,
          ...buildTenantConfirmationEmail({
            tenantName: tenant.name,
            reservationId: id,
            firstName: data.first_name,
            surname: data.surname,
            telephone: data.telephone,
            customerEmail: data.email,
            reservationDate: data.reservation_date,
            reservationTime: data.reservation_time,
            guests: data.guests,
            dietaryRequirements: data.dietary_requirements ?? null,
          }),
        }),
      ]);
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[email] send failed (index ${i}):`, r.reason);
        }
      });
    })(),
  );

  return c.json({ ...data, id, created_date: now, modified_date: now }, 201);
});

reservations.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const email = c.req.query('email');
  const token = c.req.query('token');
  const msg = await c.req.json().catch(() => null);
  const parsed = UpdateReservationSchema.safeParse(msg);
  if (!parsed.success) {
    console.error('[reservations] PATCH validation failed', { error: z.prettifyError(parsed.error), id });
    return c.json({ error: z.prettifyError(parsed.error) }, 400);
  }

  const existing = await c.env.maximum_bookings_db
    .prepare(
      `SELECT r.*, t.name AS tenant_name, t.contact_email,
			        t.max_guests AS max_guests, t.max_covers AS max_covers,
			        t.concurrent_guests_time_limit AS concurrent_guests_time_limit
			 FROM Reservations r JOIN Tenants t ON t.id = r.tenant_id WHERE r.id = ?`,
    )
    .bind(id)
    .first<
      ReservationWithTenant & {
        manage_token_hash: string | null;
        max_guests: number;
        max_covers: number;
        concurrent_guests_time_limit: number;
      }
    >();

  if (!existing || !email || existing.email.toLowerCase() !== email.toLowerCase()) {
    return c.json({ error: 'Reservation not found' }, 404);
  }

  if (
    !token ||
    !existing.manage_token_hash ||
    !(await verifyManageToken(c.env.JWT_SECRET, id, existing.email, token, existing.manage_token_hash))
  ) {
    return c.json({ error: 'Reservation not found' }, 404);
  }

  const body = parsed.data;

  const needsCapacityCheck = body.guests !== undefined || body.reservation_date !== undefined || body.reservation_time !== undefined;
  const effectiveGuests = body.guests ?? existing.guests;
  const effectiveDate = body.reservation_date ?? existing.reservation_date;
  const effectiveTime = body.reservation_time ?? existing.reservation_time;

  if (needsCapacityCheck && existing.max_guests > 0 && effectiveGuests > existing.max_guests) {
    return c.json({ error: `Maximum party size is ${existing.max_guests}` }, 422);
  }

  const data = { ...body, modified_date: new Date().toISOString() };

  if (!Object.keys(data).length) return c.json({ error: 'No valid fields to update' }, 400);

  const fields = Object.keys(data)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(data);

  try {
    if (needsCapacityCheck && existing.max_covers > 0) {
      // Atomic UPDATE: capacity check lives inside the WHERE clause, eliminating the TOCTOU race.
      // If capacity is exceeded the UPDATE matches no row; meta.changes === 0 → 422.
      const slotMin = toMinutes(effectiveTime);
      const tl = existing.concurrent_guests_time_limit;
      const updateResult = await c.env.maximum_bookings_db
        .prepare(
          `UPDATE Reservations SET ${fields}
					 WHERE id = ?
					   AND (
					     (? = 0) OR (
					       SELECT COALESCE(SUM(guests), 0)
					       FROM Reservations
					       WHERE tenant_id = ?
					         AND reservation_date = ?
					         AND id != ?
					         AND (CAST(SUBSTR(reservation_time,1,2) AS INTEGER)*60 + CAST(SUBSTR(reservation_time,4,2) AS INTEGER)) <= ?
					         AND (CAST(SUBSTR(reservation_time,1,2) AS INTEGER)*60 + CAST(SUBSTR(reservation_time,4,2) AS INTEGER)) + ? > ?
					     ) + ? <= ?
					   )`,
        )
        .bind(
          ...values,
          id,
          existing.max_covers,
          existing.tenant_id,
          effectiveDate,
          id,
          slotMin,
          tl,
          slotMin,
          effectiveGuests,
          existing.max_covers,
        )
        .run();
      if (updateResult.meta.changes === 0) {
        return c.json({ error: 'Insufficient capacity for the requested time' }, 422);
      }
    } else {
      await c.env.maximum_bookings_db
        .prepare(`UPDATE Reservations SET ${fields} WHERE id = ?`)
        .bind(...values, id)
        .run();
    }
  } catch (err) {
    console.error('[reservations] PATCH update failed', { err, id });
    return c.json({ error: 'Failed to update reservation' }, 500);
  }

  if (body.email && body.email.toLowerCase() !== existing.email.toLowerCase()) {
    const newToken = await generateManageToken(c.env.JWT_SECRET, id, body.email);
    const newHash = await hashManageToken(newToken);
    await c.env.maximum_bookings_db.prepare('UPDATE Reservations SET manage_token_hash = ? WHERE id = ?').bind(newHash, id).run();
  }

  const updated = await c.env.maximum_bookings_db
    .prepare('SELECT r.*, t.name AS tenant_name, t.contact_email FROM Reservations r JOIN Tenants t ON t.id = r.tenant_id WHERE r.id = ?')
    .bind(id)
    .first<ReservationWithTenant>();

  if (updated) {
    const amendManageToken = await generateManageToken(c.env.JWT_SECRET, id, updated.email);
    c.executionCtx.waitUntil(
      (async () => {
        const from = `"${updated.tenant_name} via Maximum Bookings" <${updated.contact_email}>`;
        const replyTo = updated.contact_email;
        const baseUrl = c.env.PUBLIC_URL ?? `${c.req.raw.headers.get('x-forwarded-proto') ?? 'https'}://${c.req.header('host')}`;
        const results = await Promise.allSettled([
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
        ]);
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

reservations.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const email = c.req.query('email');
  const token = c.req.query('token');

  const reservation = await c.env.maximum_bookings_db
    .prepare('SELECT r.*, t.name AS tenant_name, t.contact_email FROM Reservations r JOIN Tenants t ON t.id = r.tenant_id WHERE r.id = ?')
    .bind(id)
    .first<ReservationWithTenant & { manage_token_hash: string | null }>();

  if (!reservation || !email || reservation.email.toLowerCase() !== email.toLowerCase()) {
    return c.json({ error: 'Reservation not found' }, 404);
  }

  if (
    !token ||
    !reservation.manage_token_hash ||
    !(await verifyManageToken(c.env.JWT_SECRET, id, reservation.email, token, reservation.manage_token_hash))
  ) {
    return c.json({ error: 'Reservation not found' }, 404);
  }

  try {
    await c.env.maximum_bookings_db.prepare('DELETE FROM Reservations WHERE id = ?').bind(id).run();
  } catch (err) {
    console.error('[reservations] DELETE failed', { err, id });
    return c.json({ error: 'Failed to delete reservation' }, 500);
  }

  c.executionCtx.waitUntil(
    (async () => {
      const from = `"${reservation.tenant_name} via Maximum Bookings" <${reservation.contact_email}>`;
      const replyTo = reservation.contact_email;
      const results = await Promise.allSettled([
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
      ]);
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[email] send failed (index ${i}):`, r.reason);
        }
      });
    })(),
  );

  return c.json({ success: true });
});

export default reservations;
