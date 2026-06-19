import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword } from '../src/utils/auth';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-4000-8000-000000000601';
const TENANT_ID_OTHER = '00000000-0000-4000-8000-000000000602';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000701';

const BLOCK_ID_1 = '00000000-0000-4000-8000-000000000801';
const BLOCK_ID_2 = '00000000-0000-4000-8000-000000000802';
const BLOCK_ID_OTHER = '00000000-0000-4000-8000-000000000803';
const RES_ID = '00000000-0000-4000-8000-000000000901';

const BLOCK_ID_MONTH_1 = '00000000-0000-4000-8000-000000000902';
const BLOCK_ID_MONTH_2 = '00000000-0000-4000-8000-000000000903';
const BLOCK_ID_MONTH_3 = '00000000-0000-4000-8000-000000000904';

const TEST_EMAIL = 'owner@blockedvenue.com';
const TEST_PASSWORD = 'blockedpass999';

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedTenant(overrides: Record<string, unknown> = {}) {
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id ?? TENANT_ID,
      overrides.name ?? 'Blocked Venue',
      overrides.tenant_code ?? 'blockedvenue',
      overrides.max_guests ?? 50,
      overrides.max_covers ?? 20,
      overrides.status ?? 'active',
      overrides.concurrent_guests_time_limit ?? 120,
    )
    .run();
}

async function seedAdminUser(overrides: Record<string, unknown> = {}) {
  const password = (overrides.password as string) ?? TEST_PASSWORD;
  const password_hash = overrides.password_hash ?? (await hashPassword(password));
  const now = new Date().toISOString();
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO AdminUsers (id, tenant_id, email, password_hash, failed_attempts, locked_until, created_date, modified_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id ?? ADMIN_USER_ID,
      overrides.tenant_id ?? TENANT_ID,
      overrides.email ?? TEST_EMAIL,
      password_hash,
      overrides.failed_attempts ?? 0,
      overrides.locked_until ?? null,
      now,
      now,
    )
    .run();
}

async function seedBlockedDate(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO BlockedDates (id, tenant_id, date, start_time, end_time, reason, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id ?? BLOCK_ID_1,
      overrides.tenant_id ?? TENANT_ID,
      overrides.date ?? '2099-07-01',
      overrides.start_time ?? null,
      overrides.end_time ?? null,
      overrides.reason ?? null,
      now,
    )
    .run();
}

async function seedReservation(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Reservations
       (id, tenant_id, first_name, surname, telephone, email,
        reservation_date, reservation_time, guests, dietary_requirements,
        created_date, modified_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id ?? RES_ID,
      overrides.tenant_id ?? TENANT_ID,
      overrides.first_name ?? 'Jane',
      overrides.surname ?? 'Doe',
      overrides.telephone ?? '07700900099',
      overrides.email ?? 'jane@blocked.com',
      overrides.reservation_date ?? '2099-07-10',
      overrides.reservation_time ?? '19:00',
      overrides.guests ?? 2,
      overrides.dietary_requirements ?? null,
      now,
      now,
    )
    .run();
}

async function clearDb() {
  await env.maximum_bookings_db
    .prepare('DELETE FROM BlockedDates')
    .run()
    .catch(() => {});
  await env.maximum_bookings_db.prepare('DELETE FROM AdminUsers').run();
  await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run();
  await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run();
}

async function getAuthToken(email = TEST_EMAIL, password = TEST_PASSWORD): Promise<string> {
  const res = await exports.default.fetch('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as any;
  if (!body.token) throw new Error(`Login failed: ${JSON.stringify(body)}`);
  return body.token;
}

// ─── Admin: /api/admin/blocked-dates ─────────────────────────────────────────

describe('Admin: /api/admin/blocked-dates', () => {
  beforeEach(async () => {
    await clearDb();
    await seedTenant({ id: TENANT_ID, name: 'Blocked Venue', tenant_code: 'blockedvenue' });
    await seedTenant({ id: TENANT_ID_OTHER, name: 'Other Venue', tenant_code: 'othervenue' });
    await seedAdminUser({ tenant_id: TENANT_ID });
  });

  // ─── POST ────────────────────────────────────────────────────────────────

  describe('POST /api/admin/blocked-dates', () => {
    it('creates a full-day block when start_time and end_time are omitted', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2099-07-01' }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.id).toBeDefined();
      expect(body.date).toBe('2099-07-01');
      expect(body.start_time).toBeNull();
      expect(body.end_time).toBeNull();
      expect(body.tenant_id).toBe(TENANT_ID);
    });

    it('creates a time-range block when start_time and end_time are provided', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2099-07-02', start_time: '14:00', end_time: '16:00', reason: 'Private event' }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.date).toBe('2099-07-02');
      expect(body.start_time).toBe('14:00');
      expect(body.end_time).toBe('16:00');
      expect(body.reason).toBe('Private event');
    });

    it('returns 400 when date format is not YYYY-MM-DD', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '01/07/2099' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when date is missing from the request body', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'No date provided' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 401 when no Authorization header is provided', async () => {
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2099-07-01' }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET ─────────────────────────────────────────────────────────────────

  describe('GET /api/admin/blocked-dates', () => {
    it('returns all blocks for the queried date', async () => {
      await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-07-10' });
      await seedBlockedDate({ id: BLOCK_ID_2, date: '2099-07-10', start_time: '18:00', end_time: '20:00' });
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?date=2099-07-10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(body.length).toBe(2);
      expect(body.every((b: any) => b.date === '2099-07-10')).toBe(true);
      expect(body.every((b: any) => b.tenant_id === TENANT_ID)).toBe(true);
    });

    it('returns an empty array for a date that has no blocks', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?date=2099-12-31', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(body).toEqual([]);
    });

    it('does not return blocks belonging to another tenant', async () => {
      await seedBlockedDate({ id: BLOCK_ID_1, tenant_id: TENANT_ID, date: '2099-07-30' });
      await seedBlockedDate({ id: BLOCK_ID_OTHER, tenant_id: TENANT_ID_OTHER, date: '2099-07-30' });
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?date=2099-07-30', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(body.some((b: any) => b.id === BLOCK_ID_1)).toBe(true);
      expect(body.some((b: any) => b.id === BLOCK_ID_OTHER)).toBe(false);
      expect(body.some((b: any) => b.tenant_id === TENANT_ID_OTHER)).toBe(false);
    });

    it('returns 400 with error message when neither date nor month is provided', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('date or month is required');
    });
  });

  // ─── GET ?month=YYYY-MM ───────────────────────────────────────────────────

  describe('GET /api/admin/blocked-dates?month=YYYY-MM', () => {
    it('returns an empty array when no blocked dates exist for that month', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?month=2099-11', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(body).toEqual([]);
    });

    it('returns all rows for that month including full-day and time-range entries', async () => {
      await seedBlockedDate({ id: BLOCK_ID_MONTH_1, date: '2099-11-05' });
      await seedBlockedDate({ id: BLOCK_ID_MONTH_2, date: '2099-11-12', start_time: '18:00', end_time: '20:00', reason: 'Private hire' });
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?month=2099-11', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(body.length).toBe(2);
      const fullDay = body.find((b: any) => b.id === BLOCK_ID_MONTH_1);
      expect(fullDay).toBeDefined();
      expect(fullDay.date).toBe('2099-11-05');
      expect(fullDay.start_time).toBeNull();
      expect(fullDay.end_time).toBeNull();
      const timeRange = body.find((b: any) => b.id === BLOCK_ID_MONTH_2);
      expect(timeRange).toBeDefined();
      expect(timeRange.date).toBe('2099-11-12');
      expect(timeRange.start_time).toBe('18:00');
      expect(timeRange.end_time).toBe('20:00');
      expect(timeRange.reason).toBe('Private hire');
    });

    it('does not return rows from a different month', async () => {
      await seedBlockedDate({ id: BLOCK_ID_MONTH_1, date: '2099-11-10' });
      await seedBlockedDate({ id: BLOCK_ID_MONTH_3, date: '2099-12-10' });
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?month=2099-11', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(body.some((b: any) => b.id === BLOCK_ID_MONTH_1)).toBe(true);
      expect(body.some((b: any) => b.id === BLOCK_ID_MONTH_3)).toBe(false);
    });

    it('does not return rows from a different tenant', async () => {
      await seedBlockedDate({ id: BLOCK_ID_MONTH_1, tenant_id: TENANT_ID, date: '2099-11-15' });
      await seedBlockedDate({ id: BLOCK_ID_MONTH_2, tenant_id: TENANT_ID_OTHER, date: '2099-11-15' });
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?month=2099-11', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(body.some((b: any) => b.id === BLOCK_ID_MONTH_1)).toBe(true);
      expect(body.some((b: any) => b.id === BLOCK_ID_MONTH_2)).toBe(false);
      expect(body.some((b: any) => b.tenant_id === TENANT_ID_OTHER)).toBe(false);
    });

    it('returns 400 when month is missing a leading zero (e.g. 2099-5)', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?month=2099-5', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when month is not a valid format (e.g. not-a-month)', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?month=not-a-month', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(400);
    });

    it('returns 401 when no Authorization header is provided', async () => {
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates?month=2099-11');
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /date/:date ───────────────────────────────────────────────────

  describe('DELETE /api/admin/blocked-dates/date/:date', () => {
    it('removes all blocks for the given date', async () => {
      await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-07-20' });
      await seedBlockedDate({ id: BLOCK_ID_2, date: '2099-07-20', start_time: '14:00', end_time: '16:00' });
      const token = await getAuthToken();
      const res = await exports.default.fetch('http://localhost/api/admin/blocked-dates/date/2099-07-20', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 204]).toContain(res.status);

      const { results } = await env.maximum_bookings_db
        .prepare('SELECT id FROM BlockedDates WHERE tenant_id = ? AND date = ?')
        .bind(TENANT_ID, '2099-07-20')
        .run<{ id: string }>();
      expect(results).toHaveLength(0);
    });
  });

  // ─── DELETE /:id ──────────────────────────────────────────────────────────

  describe('DELETE /api/admin/blocked-dates/:id', () => {
    it('removes only the specified block by id and leaves other blocks intact', async () => {
      await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-07-25' });
      await seedBlockedDate({ id: BLOCK_ID_2, date: '2099-07-25', start_time: '14:00', end_time: '15:00' });
      const token = await getAuthToken();
      const res = await exports.default.fetch(`http://localhost/api/admin/blocked-dates/${BLOCK_ID_1}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 204]).toContain(res.status);

      const deleted = await env.maximum_bookings_db.prepare('SELECT id FROM BlockedDates WHERE id = ?').bind(BLOCK_ID_1).first();
      expect(deleted).toBeNull();

      const remaining = await env.maximum_bookings_db.prepare('SELECT id FROM BlockedDates WHERE id = ?').bind(BLOCK_ID_2).first();
      expect(remaining).not.toBeNull();
    });

    it('returns 404 when trying to delete a block that belongs to another tenant', async () => {
      await seedBlockedDate({ id: BLOCK_ID_OTHER, tenant_id: TENANT_ID_OTHER, date: '2099-07-26' });
      const token = await getAuthToken();
      const res = await exports.default.fetch(`http://localhost/api/admin/blocked-dates/${BLOCK_ID_OTHER}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(404);

      const stillExists = await env.maximum_bookings_db.prepare('SELECT id FROM BlockedDates WHERE id = ?').bind(BLOCK_ID_OTHER).first();
      expect(stillExists).not.toBeNull();
    });

    it('returns 404 when the block id does not exist', async () => {
      const token = await getAuthToken();
      const res = await exports.default.fetch(`http://localhost/api/admin/blocked-dates/00000000-0000-4000-8000-999999999999`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(404);
    });
  });
});

// ─── Public: GET /api/reservations/blocked-dates ─────────────────────────────

describe('Public: GET /api/reservations/blocked-dates', () => {
  beforeEach(async () => {
    await clearDb();
    await seedTenant({ id: TENANT_ID, name: 'Blocked Venue', tenant_code: 'blockedvenue' });
  });

  it('returns full-day blocked dates for the queried month', async () => {
    await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-08-15' });
    await seedBlockedDate({ id: BLOCK_ID_2, date: '2099-08-22' });
    const res = await exports.default.fetch(`http://localhost/api/reservations/blocked-dates?tenant_id=${TENANT_ID}&month=2099-08`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.blocked_dates).toContain('2099-08-15');
    expect(body.blocked_dates).toContain('2099-08-22');
  });

  it('does not include dates where only a time-range block exists', async () => {
    await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-08-10', start_time: '14:00', end_time: '16:00' });
    const res = await exports.default.fetch(`http://localhost/api/reservations/blocked-dates?tenant_id=${TENANT_ID}&month=2099-08`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.blocked_dates).not.toContain('2099-08-10');
  });

  it('returns 400 when tenant_id is missing', async () => {
    const res = await exports.default.fetch('http://localhost/api/reservations/blocked-dates?month=2099-08');
    expect(res.status).toBe(400);
  });

  it('returns 400 when month is missing', async () => {
    const res = await exports.default.fetch(`http://localhost/api/reservations/blocked-dates?tenant_id=${TENANT_ID}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when month format is invalid (e.g. single-digit month without leading zero)', async () => {
    const res = await exports.default.fetch(`http://localhost/api/reservations/blocked-dates?tenant_id=${TENANT_ID}&month=2099-8`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown tenant_id', async () => {
    const res = await exports.default.fetch(
      `http://localhost/api/reservations/blocked-dates?tenant_id=00000000-0000-4000-8000-999999999999&month=2099-08`,
    );
    expect(res.status).toBe(404);
  });

  it('returns an empty blocked_dates array when no full-day blocks exist for the month', async () => {
    const res = await exports.default.fetch(`http://localhost/api/reservations/blocked-dates?tenant_id=${TENANT_ID}&month=2099-09`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.blocked_dates).toEqual([]);
  });
});

// ─── GET /api/reservations/blocked-times with BlockedDates ───────────────────

describe('GET /api/reservations/blocked-times - blocked dates integration', () => {
  beforeEach(async () => {
    await clearDb();
    await seedTenant({ id: TENANT_ID, name: 'Blocked Venue', tenant_code: 'blockedvenue', max_covers: 50 });
  });

  it('returns all 20 time slots as blocked when a full-day block exists for the date', async () => {
    await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-09-01' });
    const res = await exports.default.fetch(
      `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-09-01&guests=2`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.blocked_times).toContain('12:00');
    expect(body.blocked_times).toContain('18:00');
    expect(body.blocked_times).toContain('21:30');
    expect(body.blocked_times.length).toBe(20);
  });

  it('blocks only slots within the time range and leaves outside slots unblocked', async () => {
    await seedBlockedDate({
      id: BLOCK_ID_1,
      date: '2099-09-02',
      start_time: '18:00',
      end_time: '20:00',
    });
    const res = await exports.default.fetch(
      `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-09-02&guests=2`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.blocked_times).toContain('18:00');
    expect(body.blocked_times).toContain('19:30');
    expect(body.blocked_times).not.toContain('12:00');
    expect(body.blocked_times).not.toContain('21:00');
  });

  it('full-day block causes all slots to be blocked even when concurrent capacity is not exceeded', async () => {
    await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-09-03' });
    const res = await exports.default.fetch(
      `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-09-03&guests=2`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.blocked_times.length).toBe(20);
  });
});

// ─── POST /api/reservations - blocked dates enforcement ───────────────────────

describe('POST /api/reservations - blocked dates enforcement', () => {
  const basePayload = {
    tenant_id: TENANT_ID,
    first_name: 'Test',
    surname: 'Guest',
    telephone: '07700900088',
    email: 'test@blocked.com',
    reservation_time: '19:00',
    guests: 2,
  };

  beforeEach(async () => {
    await clearDb();
    await seedTenant({ id: TENANT_ID, name: 'Blocked Venue', tenant_code: 'blockedvenue' });
  });

  it('returns 422 when attempting to create a booking on a full-day blocked date', async () => {
    await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-10-01' });
    const res = await exports.default.fetch('http://localhost/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, reservation_date: '2099-10-01' }),
    });
    expect(res.status).toBe(422);
  });

  it('allows booking creation when only a time-range block exists for the date', async () => {
    await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-10-02', start_time: '14:00', end_time: '16:00' });
    const res = await exports.default.fetch('http://localhost/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, reservation_date: '2099-10-02' }),
    });
    expect(res.status).toBe(201);
  });

  it('rejects a new booking on a blocked date without cancelling existing reservations on that date', async () => {
    await seedReservation({ id: RES_ID, reservation_date: '2099-10-05', reservation_time: '18:00' });
    await seedBlockedDate({ id: BLOCK_ID_1, date: '2099-10-05' });

    const existing = await env.maximum_bookings_db.prepare('SELECT id FROM Reservations WHERE id = ?').bind(RES_ID).first();
    expect(existing).not.toBeNull();

    const newBooking = await exports.default.fetch('http://localhost/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, reservation_date: '2099-10-05', reservation_time: '19:00' }),
    });
    expect(newBooking.status).toBe(422);

    const stillExists = await env.maximum_bookings_db.prepare('SELECT id FROM Reservations WHERE id = ?').bind(RES_ID).first();
    expect(stillExists).not.toBeNull();
  });
});
