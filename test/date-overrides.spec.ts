import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeEach } from 'vitest';
import { signJWT } from '../src/utils/auth';

const TENANT_ID = '00000000-0000-4000-8000-000000001001';
const TENANT_ID_OTHER = '00000000-0000-4000-8000-000000001002';

// 2099-06-01 is a Monday, 2099-06-02 a Tuesday.
const MONDAY = '2099-06-01';
const TUESDAY = '2099-06-02';

async function seedTenant(overrides: Record<string, unknown> = {}) {
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id ?? TENANT_ID,
      overrides.name ?? 'Override Venue',
      overrides.tenant_code ?? 'override-venue',
      50,
      overrides.max_covers ?? 20,
      'active',
      120,
    )
    .run();
}

/** Weekly schedule: closed on Mondays, 12:00–22:00 on every other day. */
async function seedWeeklyHours(tenantId: string = TENANT_ID) {
  for (const dow of [0, 1, 2, 3, 4, 5, 6]) {
    const closed = dow === 1;
    await env.maximum_bookings_db
      .prepare('INSERT INTO OpeningHours (id, tenant_id, day_of_week, is_closed, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), tenantId, dow, closed ? 1 : 0, closed ? null : '12:00', closed ? null : '22:00')
      .run();
  }
}

async function seedOverride(overrides: Record<string, unknown> = {}) {
  const isClosed = overrides.is_closed ?? 0;
  await env.maximum_bookings_db
    .prepare('INSERT INTO DateOverrides (id, tenant_id, date, is_closed, open_time, close_time, reason) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(
      crypto.randomUUID(),
      overrides.tenant_id ?? TENANT_ID,
      overrides.date ?? TUESDAY,
      isClosed,
      isClosed ? null : (overrides.open_time ?? '12:00'),
      isClosed ? null : (overrides.close_time ?? '16:00'),
      overrides.reason ?? null,
    )
    .run();
}

async function clearDb() {
  await env.maximum_bookings_db.prepare('DELETE FROM DateOverrides').run();
  await env.maximum_bookings_db.prepare('DELETE FROM BlockedDates').run();
  await env.maximum_bookings_db.prepare('DELETE FROM OpeningHours').run();
  await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run();
  await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run();
}

async function adminRequest(path: string, init: { method?: string; body?: unknown; tenantId?: string } = {}) {
  const token = await signJWT({ userId: '00000000-0000-4000-8000-0000000010a1', tenantId: init.tenantId ?? TENANT_ID }, env.JWT_SECRET);
  return exports.default.fetch(`http://localhost/api/admin/date-overrides${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function storedOverrides(tenantId: string = TENANT_ID) {
  const { results } = await env.maximum_bookings_db
    .prepare('SELECT date, is_closed, open_time, close_time, reason FROM DateOverrides WHERE tenant_id = ? ORDER BY date')
    .bind(tenantId)
    .run();
  return results;
}

async function blockedTimes(date: string, tenantId: string = TENANT_ID) {
  const res = await exports.default.fetch(`http://localhost/api/reservations/blocked-times?tenant_id=${tenantId}&date=${date}&guests=2`);
  return (await res.json()) as { slots: string[]; blocked_times: string[] };
}

async function closedDates(month: string, tenantId: string = TENANT_ID) {
  const res = await exports.default.fetch(`http://localhost/api/reservations/blocked-dates?tenant_id=${tenantId}&month=${month}`);
  return ((await res.json()) as { closed_dates: string[] }).closed_dates;
}

async function book(date: string, time: string, tenantId: string = TENANT_ID) {
  return exports.default.fetch('http://localhost/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      first_name: 'Cara',
      surname: 'Customer',
      telephone: '07700900123',
      email: `cara-${date}-${time.replace(':', '')}@example.com`,
      reservation_date: date,
      reservation_time: time,
      guests: 2,
    }),
  });
}

beforeEach(async () => {
  await clearDb();
  await seedTenant();
  await seedWeeklyHours();
});

describe('PUT /api/admin/date-overrides/:date', () => {
  it('stores special hours for a date and returns the row', async () => {
    const res = await adminRequest(`/${TUESDAY}`, {
      method: 'PUT',
      body: { is_closed: false, open_time: '12:00', close_time: '16:00', reason: '  Boxing Day  ' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toMatchObject({ date: TUESDAY, is_closed: 0, open_time: '12:00', close_time: '16:00', reason: 'Boxing Day' });
    expect(await storedOverrides()).toEqual([
      { date: TUESDAY, is_closed: 0, open_time: '12:00', close_time: '16:00', reason: 'Boxing Day' },
    ]);
  });

  it('replaces the hours when saved again for the same date, keeping one row', async () => {
    await adminRequest(`/${TUESDAY}`, { method: 'PUT', body: { is_closed: false, open_time: '12:00', close_time: '16:00' } });
    const res = await adminRequest(`/${TUESDAY}`, { method: 'PUT', body: { is_closed: false, open_time: '10:00', close_time: '15:00' } });

    expect(res.status).toBe(200);
    expect(await storedOverrides()).toEqual([{ date: TUESDAY, is_closed: 0, open_time: '10:00', close_time: '15:00', reason: null }]);
  });

  it('stores a closed date without times, even when times are sent', async () => {
    const res = await adminRequest(`/${TUESDAY}`, { method: 'PUT', body: { is_closed: true, open_time: '12:00', close_time: '16:00' } });

    expect(res.status).toBe(200);
    expect(await storedOverrides()).toEqual([{ date: TUESDAY, is_closed: 1, open_time: null, close_time: null, reason: null }]);
  });

  it.each([
    ['open without times', { is_closed: false }],
    ['open with only one time', { is_closed: false, open_time: '12:00' }],
    ['an invalid time', { is_closed: false, open_time: '12:00', close_time: '24:00' }],
    ['a single-digit hour', { is_closed: false, open_time: '9:00', close_time: '16:00' }],
    ['close equal to open', { is_closed: false, open_time: '12:00', close_time: '12:00' }],
    ['close before open', { is_closed: false, open_time: '16:00', close_time: '12:00' }],
    ['a reason over 200 characters', { is_closed: false, open_time: '12:00', close_time: '16:00', reason: 'a'.repeat(201) }],
    ['a missing is_closed', { open_time: '12:00', close_time: '16:00' }],
  ])('returns 400 for %s and stores nothing', async (_label, body) => {
    const res = await adminRequest(`/${TUESDAY}`, { method: 'PUT', body });

    expect(res.status).toBe(400);
    expect(await storedOverrides()).toEqual([]);
  });

  it.each(['2099-13-01', '2099-02-30', 'tomorrow'])('returns 400 for the invalid date %s', async (date) => {
    const res = await adminRequest(`/${date}`, { method: 'PUT', body: { is_closed: false, open_time: '12:00', close_time: '16:00' } });
    expect(res.status).toBe(400);
  });

  it('returns 401 without an admin token', async () => {
    const res = await exports.default.fetch(`http://localhost/api/admin/date-overrides/${TUESDAY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_closed: true }),
    });
    expect(res.status).toBe(401);
  });

  it("writes only to the signed-in tenant, leaving another tenant's override for the same date alone", async () => {
    await seedTenant({ id: TENANT_ID_OTHER, name: 'Other Venue', tenant_code: 'other-venue' });
    await seedOverride({ tenant_id: TENANT_ID_OTHER, open_time: '09:00', close_time: '11:00' });

    await adminRequest(`/${TUESDAY}`, { method: 'PUT', body: { is_closed: false, open_time: '12:00', close_time: '16:00' } });

    expect(await storedOverrides(TENANT_ID_OTHER)).toEqual([
      { date: TUESDAY, is_closed: 0, open_time: '09:00', close_time: '11:00', reason: null },
    ]);
    expect(await storedOverrides()).toHaveLength(1);
  });
});

describe('GET /api/admin/date-overrides', () => {
  it("returns the month's overrides for the signed-in tenant only, in date order", async () => {
    await seedTenant({ id: TENANT_ID_OTHER, name: 'Other Venue', tenant_code: 'other-venue' });
    await seedOverride({ date: '2099-06-20' });
    await seedOverride({ date: '2099-06-02', is_closed: 1 });
    await seedOverride({ date: '2099-07-01' });
    await seedOverride({ tenant_id: TENANT_ID_OTHER, date: '2099-06-10' });

    const res = await adminRequest('?month=2099-06');

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.map((r: any) => r.date)).toEqual(['2099-06-02', '2099-06-20']);
  });

  it.each(['', '?month=2099-6', '?month=june'])('returns 400 for a missing or invalid month (%s)', async (query) => {
    expect((await adminRequest(query)).status).toBe(400);
  });
});

describe('DELETE /api/admin/date-overrides/:date', () => {
  it('removes the override so the weekly hours apply again', async () => {
    await seedOverride({ date: TUESDAY, open_time: '12:00', close_time: '14:00' });
    expect((await blockedTimes(TUESDAY)).slots).toEqual(['12:00', '12:30', '13:00', '13:30']);

    const res = await adminRequest(`/${TUESDAY}`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(await storedOverrides()).toEqual([]);
    expect((await blockedTimes(TUESDAY)).slots).toHaveLength(20);
  });

  it('returns 404 when the date has no override', async () => {
    expect((await adminRequest(`/${TUESDAY}`, { method: 'DELETE' })).status).toBe(404);
  });

  it("returns 404 for another tenant's override and leaves it in place", async () => {
    await seedTenant({ id: TENANT_ID_OTHER, name: 'Other Venue', tenant_code: 'other-venue' });
    await seedOverride({ tenant_id: TENANT_ID_OTHER });

    expect((await adminRequest(`/${TUESDAY}`, { method: 'DELETE' })).status).toBe(404);
    expect(await storedOverrides(TENANT_ID_OTHER)).toHaveLength(1);
  });
});

describe('Special hours in availability and booking', () => {
  it('uses the weekly hours when the date has no override', async () => {
    const tuesday = await blockedTimes(TUESDAY);
    expect(tuesday.slots[0]).toBe('12:00');
    expect(tuesday.slots[tuesday.slots.length - 1]).toBe('21:30');
    expect(tuesday.blocked_times).toEqual([]);
    expect((await blockedTimes(MONDAY)).slots).toEqual([]);
  });

  it('offers only the special hours on a normally open day', async () => {
    await seedOverride({ date: TUESDAY, open_time: '12:00', close_time: '16:00' });

    expect((await blockedTimes(TUESDAY)).slots).toEqual(['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30']);
    expect((await book(TUESDAY, '15:30')).status).toBe(201);
    const afterClose = await book(TUESDAY, '16:00');
    expect(afterClose.status).toBe(422);
    expect(((await afterClose.json()) as any).error).toBe('Bookings are not available for this time');
  });

  it('can open earlier than the weekly hours', async () => {
    await seedOverride({ date: TUESDAY, open_time: '09:00', close_time: '11:00' });

    expect((await blockedTimes(TUESDAY)).slots).toEqual(['09:00', '09:30', '10:00', '10:30']);
    expect((await book(TUESDAY, '09:30')).status).toBe(201);
    expect((await book(TUESDAY, '12:00')).status).toBe(422);
  });

  it('opens a normally closed day', async () => {
    await seedOverride({ date: MONDAY, open_time: '12:00', close_time: '14:00' });

    expect((await blockedTimes(MONDAY)).slots).toEqual(['12:00', '12:30', '13:00', '13:30']);
    expect(await closedDates('2099-06')).not.toContain(MONDAY);
    expect(await closedDates('2099-06')).toContain('2099-06-08');
    expect((await book(MONDAY, '12:30')).status).toBe(201);
  });

  it('closes a normally open day', async () => {
    await seedOverride({ date: TUESDAY, is_closed: 1 });

    expect((await blockedTimes(TUESDAY)).slots).toEqual([]);
    expect(await closedDates('2099-06')).toContain(TUESDAY);
    const res = await book(TUESDAY, '13:00');
    expect(res.status).toBe(422);
    expect(((await res.json()) as any).error).toBe('Bookings are not available for this date');
  });

  it('still applies time-range blocks inside the special hours', async () => {
    await seedOverride({ date: TUESDAY, open_time: '12:00', close_time: '16:00' });
    await env.maximum_bookings_db
      .prepare('INSERT INTO BlockedDates (id, tenant_id, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), TENANT_ID, TUESDAY, '13:00', '14:00')
      .run();

    expect((await blockedTimes(TUESDAY)).blocked_times).toEqual(['13:00', '13:30']);
    expect((await book(TUESDAY, '13:30')).status).toBe(422);
    expect((await book(TUESDAY, '14:00')).status).toBe(201);
  });

  it('keeps a full-day block in force over special hours', async () => {
    await seedOverride({ date: MONDAY, open_time: '12:00', close_time: '14:00' });
    await env.maximum_bookings_db
      .prepare('INSERT INTO BlockedDates (id, tenant_id, date, start_time, end_time) VALUES (?, ?, ?, NULL, NULL)')
      .bind(crypto.randomUUID(), TENANT_ID, MONDAY)
      .run();

    expect((await blockedTimes(MONDAY)).slots).toEqual([]);
    expect((await book(MONDAY, '12:30')).status).toBe(422);
  });

  it("ignores another tenant's override", async () => {
    await seedTenant({ id: TENANT_ID_OTHER, name: 'Other Venue', tenant_code: 'other-venue' });
    await seedOverride({ tenant_id: TENANT_ID_OTHER, date: TUESDAY, is_closed: 1 });

    expect((await blockedTimes(TUESDAY)).slots).toHaveLength(20);
    expect(await closedDates('2099-06')).not.toContain(TUESDAY);
    expect((await book(TUESDAY, '13:00')).status).toBe(201);
  });

  it('removes overrides with their tenant', async () => {
    await seedOverride();
    await env.maximum_bookings_db.prepare('DELETE FROM Tenants WHERE id = ?').bind(TENANT_ID).run();
    expect(await storedOverrides()).toEqual([]);
  });
});
