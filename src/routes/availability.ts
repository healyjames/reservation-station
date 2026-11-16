import { Hono } from 'hono';
import { generateTimeSlots, calculateConcurrentGuests, peakConcurrentGuests, isTimeInAnyBlock } from '../utils/slots';
import { getEffectiveHours } from '../db/opening-hours';
import type { SlotReservation } from '../types';

const availability = new Hono<{ Bindings: Env }>();

availability.get('/blocked-dates', async (c) => {
  const tenantId = c.req.query('tenant_id');
  const month = c.req.query('month');

  if (!tenantId || !month) {
    return c.json({ error: 'tenant_id and month are required' }, 400);
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: 'month must be in YYYY-MM format' }, 400);
  }

  const tenant = await c.env.maximum_bookings_db.prepare('SELECT id FROM Tenants WHERE id = ?').bind(tenantId).first<{ id: string }>();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  const { results } = await c.env.maximum_bookings_db
    .prepare('SELECT DISTINCT date FROM BlockedDates WHERE tenant_id = ? AND date LIKE ? AND start_time IS NULL')
    .bind(tenantId, `${month}-%`)
    .run<{ date: string }>();

  const { results: closedDays } = await c.env.maximum_bookings_db
    .prepare('SELECT day_of_week FROM OpeningHours WHERE tenant_id = ? AND is_closed = 1')
    .bind(tenantId)
    .run<{ day_of_week: number }>();

  const adminBlockedSet = new Set(results.map((r) => r.date));

  // A date override replaces the weekly schedule for its date: it can close a normally open day or
  // open a normally closed one.
  const { results: overrides } = await c.env.maximum_bookings_db
    .prepare('SELECT date, is_closed FROM DateOverrides WHERE tenant_id = ? AND date LIKE ?')
    .bind(tenantId, `${month}-%`)
    .run<{ date: string; is_closed: number }>();

  const overrideClosedByDate = new Map(overrides.map((r) => [r.date, r.is_closed === 1]));
  const closedDowSet = new Set(closedDays.map((r) => r.day_of_week));
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const closedDatesSet = new Set(
    Array.from({ length: daysInMonth }, (_, i) => `${month}-${(i + 1).toString().padStart(2, '0')}`).filter(
      (dateStr) => overrideClosedByDate.get(dateStr) ?? closedDowSet.has(new Date(dateStr + 'T12:00:00Z').getUTCDay()),
    ),
  );

  return c.json(
    {
      blocked_dates: Array.from(adminBlockedSet),
      closed_dates: Array.from(closedDatesSet),
    },
    200,
    {
      'Cache-Control': 'private, max-age=300',
    },
  );
});

availability.get('/blocked-times', async (c) => {
  const tenantId = c.req.query('tenant_id');
  const date = c.req.query('date');
  const guestsParam = c.req.query('guests');

  if (!tenantId || !date || !guestsParam) {
    return c.json({ error: 'tenant_id, date, and guests are required' }, 400);
  }

  const requestedGuests = parseInt(guestsParam, 10);
  if (isNaN(requestedGuests) || requestedGuests <= 0) {
    return c.json({ error: 'guests must be a positive integer' }, 400);
  }

  const tenant = await c.env.maximum_bookings_db
    .prepare('SELECT max_covers, concurrent_guests_time_limit FROM Tenants WHERE id = ?')
    .bind(tenantId)
    .first<{ max_covers: number; concurrent_guests_time_limit: number }>();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  const { results: blockedDateRows } = await c.env.maximum_bookings_db
    .prepare('SELECT start_time, end_time FROM BlockedDates WHERE tenant_id = ? AND date = ?')
    .bind(tenantId, date)
    .run<{ start_time: string | null; end_time: string | null }>();

  // `slots` is every bookable start time on this date (empty when the day cannot be booked at all), so
  // clients do not have to derive it from the weekly schedule, which a date override may replace.
  const respond = (slots: string[], blockedTimes: string[]) =>
    c.json({ slots, blocked_times: blockedTimes, time_limit_minutes: tenant.concurrent_guests_time_limit }, 200, {
      'Cache-Control': 'private, max-age=60',
    });

  if (blockedDateRows.some((r) => r.start_time === null)) return respond([], generateTimeSlots());

  const hours = await getEffectiveHours({ db: c.env.maximum_bookings_db, tenantId, date });
  if (hours.isClosed) return respond([], generateTimeSlots());

  const slots = hours.openTime && hours.closeTime ? generateTimeSlots(hours.openTime, hours.closeTime) : generateTimeSlots();

  if (tenant.max_covers === 0) {
    return respond(
      slots,
      slots.filter((slot) => isTimeInAnyBlock(slot, blockedDateRows)),
    );
  }

  const { results: slotReservations } = await c.env.maximum_bookings_db
    .prepare('SELECT reservation_time, guests FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
    .bind(tenantId, date)
    .run<SlotReservation>();

  const blockedTimes: string[] = [];
  for (const slot of slots) {
    if (isTimeInAnyBlock(slot, blockedDateRows)) {
      blockedTimes.push(slot);
      continue;
    }
    // A booking here occupies the whole sitting, so block it if the peak during the sitting would overflow.
    const peak = peakConcurrentGuests(slot, slotReservations, tenant.concurrent_guests_time_limit);
    if (peak + requestedGuests > tenant.max_covers) {
      blockedTimes.push(slot);
    }
  }

  return respond(slots, blockedTimes);
});

availability.get('/availability', async (c) => {
  const tenantId = c.req.query('tenant_id');
  const dateParam = c.req.query('date');
  if (!tenantId) return c.json({ error: 'tenant_id required' }, 400);
  if (!dateParam) return c.json({ error: 'date required' }, 400);

  const parsedDate = new Date(dateParam);
  if (isNaN(parsedDate.getTime())) return c.json({ error: 'Invalid date. Expected YYYY-MM-DD' }, 400);
  const date = parsedDate.toISOString().split('T')[0];

  const tenant = await c.env.maximum_bookings_db
    .prepare('SELECT max_covers, max_guests, concurrent_guests_time_limit FROM Tenants WHERE id = ?')
    .bind(tenantId)
    .first<{ max_covers: number; max_guests: number; concurrent_guests_time_limit: number }>();

  if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

  const { results: slotReservations } = await c.env.maximum_bookings_db
    .prepare('SELECT reservation_time, guests FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
    .bind(tenantId, date)
    .run<SlotReservation>();

  const slots = generateTimeSlots().map((time) => {
    const concurrent_guests = calculateConcurrentGuests(time, slotReservations, tenant.concurrent_guests_time_limit);
    return {
      time,
      concurrent_guests,
      available_capacity: Math.max(0, tenant.max_covers - concurrent_guests),
    };
  });

  return c.json({
    date,
    max_covers: tenant.max_covers,
    max_guests: tenant.max_guests,
    time_limit_minutes: tenant.concurrent_guests_time_limit,
    slots,
  });
});

export default availability;
