import { Hono } from 'hono';
import { generateTimeSlots, calculateConcurrentGuests, toMinutes } from '../utils/slots';
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

  const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT id FROM Tenants WHERE id = ?')
		.bind(tenantId)
		.first<{ id: string }>();

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

  const closedDatesSet = new Set<string>();
  if (closedDays.length > 0) {
		const [year, monthNum] = month.split('-').map(Number);
    const closedDowSet = new Set(closedDays.map((r) => r.day_of_week));
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
      const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay();
      if (closedDowSet.has(dow)) {
        closedDatesSet.add(dateStr);
      }
    }
  }

  return c.json({
    blocked_dates: Array.from(adminBlockedSet),
    closed_dates: Array.from(closedDatesSet),
  }, 200, {
    'Cache-Control': 'private, max-age=300',
  });
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

  if (blockedDateRows.some((r) => r.start_time === null)) {
    return c.json({ blocked_times: generateTimeSlots(), time_limit_minutes: tenant.concurrent_guests_time_limit }, 200, {
      'Cache-Control': 'private, max-age=60',
    });
  }

  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  const openingHoursRow = await c.env.maximum_bookings_db
    .prepare('SELECT is_closed, open_time, close_time FROM OpeningHours WHERE tenant_id = ? AND day_of_week = ?')
    .bind(tenantId, dow)
    .first<{ is_closed: number; open_time: string | null; close_time: string | null }>();

  if (openingHoursRow?.is_closed === 1) {
    return c.json({ blocked_times: generateTimeSlots(), time_limit_minutes: tenant.concurrent_guests_time_limit }, 200, {
      'Cache-Control': 'private, max-age=60',
    });
  }

  const slots =
    openingHoursRow?.open_time && openingHoursRow?.close_time
      ? generateTimeSlots(openingHoursRow.open_time, openingHoursRow.close_time)
      : generateTimeSlots();

  if (tenant.max_covers === 0) {
    const blockedTimes = slots.filter((slot) =>
      blockedDateRows.some((r) => {
        if (r.start_time === null || r.end_time === null) return false;
        const s = toMinutes(slot),
          a = toMinutes(r.start_time),
          b = toMinutes(r.end_time);
        return b <= a ? s >= a || s < b : s >= a && s < b;
      }),
    );
    return c.json({ blocked_times: blockedTimes, time_limit_minutes: tenant.concurrent_guests_time_limit }, 200, {
      'Cache-Control': 'private, max-age=60',
    });
  }

  const { results: slotReservations } = await c.env.maximum_bookings_db
    .prepare('SELECT reservation_time, guests FROM Reservations WHERE tenant_id = ? AND reservation_date = ?')
    .bind(tenantId, date)
    .run<SlotReservation>();

  const blockedTimes: string[] = [];
  for (const slot of slots) {
    const partiallyBlocked = blockedDateRows.some((r) => {
      if (r.start_time === null || r.end_time === null) return false;
      const s = toMinutes(slot),
        a = toMinutes(r.start_time),
        b = toMinutes(r.end_time);
      return b <= a ? s >= a || s < b : s >= a && s < b;
    });
    if (partiallyBlocked) {
      blockedTimes.push(slot);
      continue;
    }
    const concurrent = calculateConcurrentGuests(slot, slotReservations, tenant.concurrent_guests_time_limit);
    if (concurrent + requestedGuests > tenant.max_covers) {
      blockedTimes.push(slot);
    }
  }

  return c.json({
    blocked_times: blockedTimes,
    time_limit_minutes: tenant.concurrent_guests_time_limit,
  }, 200, {
    'Cache-Control': 'private, max-age=60',
  });
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
