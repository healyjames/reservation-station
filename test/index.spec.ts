import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeEach } from 'vitest';
import { signJWT } from '../src/utils/auth';
import { generateManageToken, hashManageToken } from '../src/utils/manageToken';

// ─── Seed helpers ────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const TENANT_ID_2 = '00000000-0000-4000-8000-000000000002';
const RES_ID = '00000000-0000-4000-8000-000000000010';
const BLOCK_ID = '00000000-0000-4000-8000-000000000020';
const BLOCK_ID_2 = '00000000-0000-4000-8000-000000000021';

async function seedTenant(overrides: Record<string, unknown> = {}) {
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id ?? TENANT_ID,
      overrides.name ?? 'Test Restaurant',
      overrides.tenant_code ?? 'test-restaurant',
      overrides.max_guests ?? 50,
      overrides.max_covers ?? 20,
      overrides.status ?? 'active',
      overrides.concurrent_guests_time_limit ?? 120,
    )
    .run();
}

/** Seeds a reservation and returns the customer manage query (`email=…&token=…`) for it. */
async function seedReservation(overrides: Record<string, unknown> = {}): Promise<string> {
  const now = new Date().toISOString();
  const id = (overrides.id as string) ?? RES_ID;
  const email = (overrides.email as string) ?? 'jane@example.com';
  const manageToken = await generateManageToken(env.JWT_SECRET, id, email);
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Reservations
      (id, tenant_id, first_name, surname, telephone, email,
       reservation_date, reservation_time, guests, dietary_requirements,
       created_date, modified_date, manage_token_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      overrides.tenant_id ?? TENANT_ID,
      overrides.first_name ?? 'Jane',
      overrides.surname ?? 'Doe',
      overrides.telephone ?? '07700900000',
      email,
      overrides.reservation_date ?? '2099-06-01', // far future avoids same-day blocks
      overrides.reservation_time ?? '19:00',
      overrides.guests ?? 2,
      overrides.dietary_requirements ?? null,
      now,
      now,
      await hashManageToken(manageToken),
    )
    .run();
  return `email=${encodeURIComponent(email)}&token=${manageToken}`;
}

async function adminHeaders(tenantId: string = TENANT_ID): Promise<Record<string, string>> {
  const token = await signJWT({ userId: '00000000-0000-4000-8000-0000000000a1', tenantId }, env.JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

async function seedBlockedDate(overrides: Record<string, unknown> = {}) {
  await env.maximum_bookings_db
    .prepare('INSERT INTO BlockedDates (id, tenant_id, date, start_time, end_time, created_date) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(
      overrides.id ?? BLOCK_ID,
      overrides.tenant_id ?? TENANT_ID,
      overrides.date ?? '2099-06-20',
      overrides.start_time ?? null,
      overrides.end_time ?? null,
      new Date().toISOString(),
    )
    .run();
}

async function clearDb() {
  await env.maximum_bookings_db.prepare('DELETE FROM BlockedDates').run();
  await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run();
  await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run();
}

// ─── Reservations ─────────────────────────────────────────────────────────────

describe('Reservations', () => {
  beforeEach(async () => {
    await clearDb();
    await seedTenant();
  });

  // GET /api/reservations (admin only, scoped to the token's tenant)
  describe('GET /api/reservations', () => {
    it('returns 401 without an admin token', async () => {
      const res = await exports.default.fetch('http://localhost/api/reservations');
      expect(res.status).toBe(401);
    });

    it('returns empty array with no reservations', async () => {
      const res = await exports.default.fetch('http://localhost/api/reservations', { headers: await adminHeaders() });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it('returns only reservations for the tenant in the token', async () => {
      await seedTenant({ id: TENANT_ID_2, name: 'Other Place', tenant_code: 'other-place' });
      await seedReservation({ id: RES_ID, tenant_id: TENANT_ID });
      await seedReservation({ id: '00000000-0000-4000-8000-000000000011', tenant_id: TENANT_ID_2 });

      const res = await exports.default.fetch(`http://localhost/api/reservations?tenant_id=${TENANT_ID_2}`, {
        headers: await adminHeaders(TENANT_ID),
      });
      const body = (await res.json()) as any[];
      expect(body.map((r) => r.id)).toEqual([RES_ID]);
    });

    it('filters by date', async () => {
      await seedReservation({ id: RES_ID, reservation_date: '2099-06-01' });
      await seedReservation({ id: '00000000-0000-4000-8000-000000000011', reservation_date: '2099-07-01' });

      const res = await exports.default.fetch(`http://localhost/api/reservations?date=2099-06-01`, { headers: await adminHeaders() });
      const body = (await res.json()) as any[];
      expect(body).toHaveLength(1);
      expect(body[0].reservation_date).toBe('2099-06-01');
    });
  });

  // GET /api/reservations/:id
  describe('GET /api/reservations/:id', () => {
    it('returns a reservation to the matching email without exposing the manage token hash', async () => {
      await seedReservation();
      const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?email=jane@example.com`);
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.id).toBe(RES_ID);
      expect(body).not.toHaveProperty('manage_token_hash');
    });

    it('returns 404 when the email is missing or does not match', async () => {
      await seedReservation();
      const missing = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}`);
      const wrong = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?email=someone@example.com`);
      expect(missing.status).toBe(404);
      expect(wrong.status).toBe(404);
    });

    it('returns 404 for unknown id', async () => {
      const res = await exports.default.fetch(`http://localhost/api/reservations/00000000-0000-4000-8000-999999999999`);
      expect(res.status).toBe(404);
    });
  });

  // POST /api/reservations
  describe('POST /api/reservations', () => {
    const validPayload = {
      tenant_id: TENANT_ID,
      first_name: 'John',
      surname: 'Smith',
      telephone: '07700900001',
      email: 'john@example.com',
      reservation_date: '2099-06-15',
      reservation_time: '20:00',
      guests: 4,
    };

    it('creates a reservation and returns 201', async () => {
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });
      const body = (await res.json()) as any;
      expect(res.status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.created_date).toBeDefined();
      expect(body.modified_date).toBeDefined();
    });

    it('rejects unknown tenant with 404', async () => {
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, tenant_id: '00000000-0000-4000-8000-999999999999' }),
      });
      expect(res.status).toBe(404);
    });

    it('rejects invalid email with 400', async () => {
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, email: 'not-an-email' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid date format with 400', async () => {
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, reservation_date: '15/06/2099' }),
      });
      expect(res.status).toBe(400);
    });

    it('blocks booking when a full-day block exists for the date', async () => {
      await seedTenant({ id: TENANT_ID_2, name: 'Blocked Day Venue' });
      const today = new Date().toISOString().split('T')[0];
      await env.maximum_bookings_db
        .prepare(
          `INSERT INTO BlockedDates (id, tenant_id, date, start_time, end_time, created_date)
           VALUES (?, ?, ?, NULL, NULL, ?)`,
        )
        .bind('00000000-0000-4000-8000-000000000099', TENANT_ID_2, today, new Date().toISOString())
        .run();
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, tenant_id: TENANT_ID_2, reservation_date: today }),
      });
      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.error).toMatch(/not available/i);
    });

    it('allows bookings on the same day in non-overlapping time windows', async () => {
      await seedReservation({ id: RES_ID, guests: 4, reservation_date: '2099-06-15', reservation_time: '12:00' });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000011',
        guests: 4,
        reservation_date: '2099-06-15',
        reservation_time: '18:00',
      });
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, guests: 4, reservation_time: '19:00' }),
      });
      expect(res.status).toBe(201);
    });

    it('allows non-overlapping same-day bookings that exceed the old daily-total model', async () => {
      await seedTenant({
        id: TENANT_ID_2,
        name: 'Rolling Capacity Venue',
        tenant_code: 'rolling-capacity',
        max_covers: 8,
        concurrent_guests_time_limit: 120,
      });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000017',
        tenant_id: TENANT_ID_2,
        guests: 4,
        reservation_date: '2099-06-15',
        reservation_time: '12:00',
      });
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, tenant_id: TENANT_ID_2, reservation_time: '18:00', guests: 4 }),
      });
      expect(res.status).toBe(201);
    });

    it('rejects a booking that would exceed max_covers in the concurrent window', async () => {
      await seedTenant({
        id: TENANT_ID_2,
        name: 'Small Venue',
        tenant_code: 'small-venue',
        max_covers: 8,
        concurrent_guests_time_limit: 120,
      });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000012',
        tenant_id: TENANT_ID_2,
        guests: 6,
        reservation_date: '2099-06-15',
        reservation_time: '20:00',
      });
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, tenant_id: TENANT_ID_2, guests: 3, reservation_time: '20:30' }),
      });
      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.error).toMatch(/capacity|covers/i);
    });

    it('allows a booking at exactly the time limit boundary (not concurrent)', async () => {
      await seedTenant({
        id: TENANT_ID_2,
        name: 'Small Venue',
        tenant_code: 'small-venue',
        max_covers: 8,
        concurrent_guests_time_limit: 120,
      });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000013',
        tenant_id: TENANT_ID_2,
        guests: 8,
        reservation_date: '2099-06-15',
        reservation_time: '20:00',
      });
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, tenant_id: TENANT_ID_2, guests: 8, reservation_time: '22:00' }),
      });
      expect(res.status).toBe(201);
    });

    it('allows booking when max_covers is 0 (unlimited)', async () => {
      await seedTenant({
        id: TENANT_ID_2,
        name: 'Unlimited Venue',
        tenant_code: 'unlimited-venue',
        max_guests: 0,
        max_covers: 0,
        concurrent_guests_time_limit: 120,
      });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000014',
        tenant_id: TENANT_ID_2,
        guests: 50,
        reservation_date: '2099-06-15',
        reservation_time: '20:00',
      });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000015',
        tenant_id: TENANT_ID_2,
        guests: 60,
        reservation_date: '2099-06-15',
        reservation_time: '20:00',
      });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000016',
        tenant_id: TENANT_ID_2,
        guests: 70,
        reservation_date: '2099-06-15',
        reservation_time: '20:00',
      });
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, tenant_id: TENANT_ID_2, guests: 80, reservation_time: '20:00' }),
      });
      expect(res.status).toBe(201);
    });

    it('rejects a booking whose sitting would overlap a later booking and exceed max_covers', async () => {
      // Whole-sitting rule: 13:00 occupies [13:00, 15:00), which includes the 14:50 booking's start.
      // 8 + 8 = 16 > 8 at 14:50, so it must be rejected even though 13:00 itself is empty.
      await seedTenant({
        id: TENANT_ID_2,
        name: 'Small Venue',
        tenant_code: 'small-venue',
        max_covers: 8,
        concurrent_guests_time_limit: 120,
      });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000017',
        tenant_id: TENANT_ID_2,
        guests: 8,
        reservation_date: '2099-06-15',
        reservation_time: '14:50',
      });
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, tenant_id: TENANT_ID_2, guests: 8, reservation_time: '13:00' }),
      });
      expect(res.status).toBe(422);
    });

    it("ignores another tenant's bookings when checking the sitting", async () => {
      await seedTenant({ max_covers: 8, concurrent_guests_time_limit: 120 });
      await seedTenant({ id: TENANT_ID_2, name: 'Other Place', tenant_code: 'other-place', max_covers: 8 });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000017',
        tenant_id: TENANT_ID_2,
        guests: 8,
        reservation_date: '2099-06-15',
        reservation_time: '14:50',
      });
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, guests: 8, reservation_time: '13:00' }),
      });
      expect(res.status).toBe(201);
    });

    it('checks the peak occupancy during the sitting, not the sum of every overlapping booking', async () => {
      // 12:00 x4 leaves at 14:00; 13:30 x3 and 14:30 x5 overlap from 14:30 → peak 8 within [13:00, 15:00).
      await seedTenant({ max_covers: 10, concurrent_guests_time_limit: 120 });
      const day = { reservation_date: '2099-06-15' };
      await seedReservation({
        ...day,
        id: '00000000-0000-4000-8000-000000000040',
        email: 'a@example.com',
        reservation_time: '12:00',
        guests: 4,
      });
      await seedReservation({
        ...day,
        id: '00000000-0000-4000-8000-000000000041',
        email: 'b@example.com',
        reservation_time: '13:30',
        guests: 3,
      });
      await seedReservation({
        ...day,
        id: '00000000-0000-4000-8000-000000000042',
        email: 'c@example.com',
        reservation_time: '14:30',
        guests: 5,
      });
      const book = (guests: number, email: string) =>
        exports.default.fetch('http://localhost/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...validPayload, email, guests, reservation_time: '13:00' }),
        });
      expect((await book(3, 'too-many@example.com')).status).toBe(422); // 8 + 3 = 11 > 10
      expect((await book(2, 'fits@example.com')).status).toBe(201); // 8 + 2 = 10
    });

    it('allows a booking whose sitting ends exactly when a later booking starts', async () => {
      await seedTenant({
        id: TENANT_ID_2,
        name: 'Small Venue',
        tenant_code: 'small-venue',
        max_covers: 8,
        concurrent_guests_time_limit: 120,
      });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000017',
        tenant_id: TENANT_ID_2,
        guests: 8,
        reservation_date: '2099-06-15',
        reservation_time: '15:00',
      });
      // [13:00, 15:00) does not include 15:00.
      const res = await exports.default.fetch('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validPayload, tenant_id: TENANT_ID_2, guests: 8, reservation_time: '13:00' }),
      });
      expect(res.status).toBe(201);
    });
  });

  // PATCH /api/reservations/:id
  describe('PATCH /api/reservations/:id', () => {
    it('updates allowed fields', async () => {
      const manageQuery = await seedReservation();
      const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?${manageQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: 'Updated', guests: 3 }),
      });
      expect(res.status).toBe(200);

      const row = await env.maximum_bookings_db
        .prepare('SELECT first_name, guests FROM Reservations WHERE id = ?')
        .bind(RES_ID)
        .first<{ first_name: string; guests: number }>();
      expect(row?.first_name).toBe('Updated');
      expect(row?.guests).toBe(3);
    });

    it('bumps modified_date on update', async () => {
      const manageQuery = await seedReservation();
      await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?${manageQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: 'Changed' }),
      });
      const row = await env.maximum_bookings_db
        .prepare('SELECT modified_date FROM Reservations WHERE id = ?')
        .bind(RES_ID)
        .first<{ modified_date: string }>();
      expect(row?.modified_date).toBeDefined();
    });

    it('returns 422 when the new time would overlap a later booking and exceed max_covers', async () => {
      await seedTenant({ max_covers: 10, concurrent_guests_time_limit: 120 });
      const manageQuery = await seedReservation({ reservation_date: '2099-06-15', reservation_time: '19:00', guests: 4 });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000030',
        email: 'other@example.com',
        reservation_date: '2099-06-15',
        reservation_time: '15:00',
        guests: 8,
      });
      // Moving 4 guests to 14:00 → sitting [14:00, 16:00) includes 15:00 where 8 are seated: 12 > 10.
      const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?${manageQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_time: '14:00' }),
      });
      expect(res.status).toBe(422);
      const row = await env.maximum_bookings_db
        .prepare('SELECT reservation_time FROM Reservations WHERE id = ?')
        .bind(RES_ID)
        .first<{ reservation_time: string }>();
      expect(row?.reservation_time).toBe('19:00');
    });

    it('does not count the booking being amended against itself', async () => {
      await seedTenant({ max_covers: 10, concurrent_guests_time_limit: 120 });
      const manageQuery = await seedReservation({ reservation_date: '2099-06-15', reservation_time: '19:00', guests: 8 });
      // 8 → 10 guests at a slightly later time overlaps its own old sitting; only the new 10 should count.
      const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?${manageQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_time: '19:30', guests: 10 }),
      });
      expect(res.status).toBe(200);
    });

    describe('blocked dates', () => {
      const BLOCK_DATE = '2099-06-20';

      async function patch(manageQuery: string, body: Record<string, unknown>) {
        return exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?${manageQuery}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      async function storedDateTime() {
        return env.maximum_bookings_db
          .prepare('SELECT reservation_date, reservation_time FROM Reservations WHERE id = ?')
          .bind(RES_ID)
          .first<{ reservation_date: string; reservation_time: string }>();
      }

      it('returns 422 and keeps the booking when the new date has a full-day block', async () => {
        await seedBlockedDate({ date: BLOCK_DATE });
        const manageQuery = await seedReservation({ reservation_date: '2099-06-15', reservation_time: '19:00' });

        const res = await patch(manageQuery, { reservation_date: BLOCK_DATE });

        expect(res.status).toBe(422);
        expect(((await res.json()) as any).error).toBe('Bookings are not available for this date');
        expect(await storedDateTime()).toEqual({ reservation_date: '2099-06-15', reservation_time: '19:00' });
      });

      it('returns 422 when the new time is inside a partial block, including exactly at its start', async () => {
        await seedBlockedDate({ date: BLOCK_DATE, start_time: '14:00', end_time: '16:00' });
        const manageQuery = await seedReservation({ reservation_date: BLOCK_DATE, reservation_time: '19:00' });

        const atStart = await patch(manageQuery, { reservation_time: '14:00' });
        expect(atStart.status).toBe(422);
        expect(((await atStart.json()) as any).error).toBe('Bookings are not available for this time');
        expect((await patch(manageQuery, { reservation_time: '15:30' })).status).toBe(422);
        expect((await storedDateTime())?.reservation_time).toBe('19:00');
      });

      it('returns 422 when only the date changes and the existing time is inside a partial block on the new date', async () => {
        await seedBlockedDate({ date: BLOCK_DATE, start_time: '18:00', end_time: '20:00' });
        const manageQuery = await seedReservation({ reservation_date: '2099-06-15', reservation_time: '19:00' });

        expect((await patch(manageQuery, { reservation_date: BLOCK_DATE })).status).toBe(422);
      });

      it('allows a move to a time outside the partial block, including exactly at its end', async () => {
        await seedBlockedDate({ date: BLOCK_DATE, start_time: '14:00', end_time: '16:00' });
        const manageQuery = await seedReservation({ reservation_date: BLOCK_DATE, reservation_time: '19:00' });

        expect((await patch(manageQuery, { reservation_time: '16:00' })).status).toBe(200);
        expect((await storedDateTime())?.reservation_time).toBe('16:00');
      });

      it('still allows guests and details to change on a booking that already sits inside a block', async () => {
        await seedBlockedDate({ date: BLOCK_DATE });
        await seedBlockedDate({ id: BLOCK_ID_2, date: BLOCK_DATE, start_time: '18:00', end_time: '20:00' });
        const manageQuery = await seedReservation({ reservation_date: BLOCK_DATE, reservation_time: '19:00', guests: 2 });

        expect((await patch(manageQuery, { guests: 4, first_name: 'Janet' })).status).toBe(200);
        // Re-sending the unchanged date and time is not a move either.
        expect((await patch(manageQuery, { reservation_date: BLOCK_DATE, reservation_time: '19:00', guests: 3 })).status).toBe(200);
      });

      it("ignores another tenant's blocks", async () => {
        await seedTenant({ id: TENANT_ID_2, name: 'Other Place', tenant_code: 'other-place' });
        await seedBlockedDate({ tenant_id: TENANT_ID_2, date: BLOCK_DATE });
        await seedBlockedDate({ id: BLOCK_ID_2, tenant_id: TENANT_ID_2, date: BLOCK_DATE, start_time: '12:00', end_time: '22:00' });
        const manageQuery = await seedReservation({ reservation_date: '2099-06-15', reservation_time: '19:00' });

        expect((await patch(manageQuery, { reservation_date: BLOCK_DATE })).status).toBe(200);
      });
    });

    it('returns 404 without a valid manage token', async () => {
      await seedReservation();
      const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?email=jane@example.com&token=bad`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: 'Hacked' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns 400 for empty body', async () => {
      const manageQuery = await seedReservation();
      const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?${manageQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  // DELETE /api/reservations/:id
  describe('DELETE /api/reservations/:id', () => {
    it('deletes a reservation', async () => {
      const manageQuery = await seedReservation();
      const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?${manageQuery}`, { method: 'DELETE' });
      expect(res.status).toBe(200);
      const row = await env.maximum_bookings_db.prepare('SELECT id FROM Reservations WHERE id = ?').bind(RES_ID).first();
      expect(row).toBeNull();
    });

    it('returns 404 and keeps the reservation without a valid manage token', async () => {
      await seedReservation();
      const res = await exports.default.fetch(`http://localhost/api/reservations/${RES_ID}?email=jane@example.com&token=bad`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
      const row = await env.maximum_bookings_db.prepare('SELECT id FROM Reservations WHERE id = ?').bind(RES_ID).first();
      expect(row).not.toBeNull();
    });

    it('returns 404 for unknown reservation', async () => {
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/00000000-0000-4000-8000-999999999999?email=jane@example.com&token=x`,
        {
          method: 'DELETE',
        },
      );
      expect(res.status).toBe(404);
    });
  });

  // GET /api/reservations/availability
  describe('GET /api/reservations/availability', () => {
    it('returns correct remaining covers', async () => {
      await seedReservation({ guests: 5, reservation_date: '2099-06-01' });
      const res = await exports.default.fetch(`http://localhost/api/reservations/availability?tenant_id=${TENANT_ID}&date=2099-06-01`);
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      const slot = body.slots.find((s: any) => s.time === '19:00');
      expect(slot).toEqual({ time: '19:00', concurrent_guests: 5, available_capacity: 15 }); // max_covers=20 - 5
    });

    it('returns 400 when params are missing', async () => {
      const res = await exports.default.fetch(`http://localhost/api/reservations/availability?tenant_id=${TENANT_ID}`);
      expect(res.status).toBe(400);
    });

    it('returns full availability for a date with no bookings', async () => {
      const res = await exports.default.fetch(`http://localhost/api/reservations/availability?tenant_id=${TENANT_ID}&date=2099-12-25`);
      const body = (await res.json()) as any;
      expect(body.slots.length).toBeGreaterThan(0);
      expect(new Set(body.slots.map((s: any) => s.concurrent_guests))).toEqual(new Set([0]));
      expect(new Set(body.slots.map((s: any) => s.available_capacity))).toEqual(new Set([20]));
    });
  });

  // GET /api/reservations/blocked-times
  describe('GET /api/reservations/blocked-times', () => {
    it('returns 400 when required params are missing', async () => {
      // Missing tenant_id
      let res = await exports.default.fetch(`http://localhost/api/reservations/blocked-times?date=2099-08-01&guests=4`);
      expect(res.status).toBe(400);

      // Missing date
      res = await exports.default.fetch(`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&guests=4`);
      expect(res.status).toBe(400);

      // Missing guests
      res = await exports.default.fetch(`http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01`);
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown tenant', async () => {
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=00000000-0000-4000-8000-999999999999&date=2099-08-01&guests=4`,
      );
      expect(res.status).toBe(404);
    });

    it('returns empty blocked_times when no reservations exist', async () => {
      await seedTenant({ max_covers: 10, concurrent_guests_time_limit: 120 });
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=4`,
      );
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.blocked_times).toEqual([]);
      expect(body.time_limit_minutes).toBe(120);
    });

    it('returns empty blocked_times when max_covers is 0 (no limit)', async () => {
      await seedTenant({ max_covers: 0, concurrent_guests_time_limit: 120 });
      await seedReservation({ reservation_date: '2099-08-01', reservation_time: '14:00', guests: 10 });
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=5`,
      );
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.blocked_times).toEqual([]);
    });

    it('blocks a slot when concurrent guests would exceed max_covers', async () => {
      await seedTenant({ max_covers: 6, concurrent_guests_time_limit: 120 });
      await seedReservation({ reservation_date: '2099-08-01', reservation_time: '14:00', guests: 5 });
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=3`,
      );
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.blocked_times).toContain('14:00');
    });

    it('does not block a slot when concurrent guests are within limit', async () => {
      await seedTenant({ max_covers: 10, concurrent_guests_time_limit: 120 });
      await seedReservation({ reservation_date: '2099-08-01', reservation_time: '14:00', guests: 3 });
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=2`,
      );
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.blocked_times).toEqual([]);
    });

    it('respects concurrent_guests_time_limit - distant slots are not blocked', async () => {
      await seedTenant({ max_covers: 6, concurrent_guests_time_limit: 60 });
      await seedReservation({ reservation_date: '2099-08-01', reservation_time: '14:00', guests: 5 });
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-08-01&guests=3`,
      );
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.blocked_times).toContain('14:00');
      expect(body.blocked_times).not.toContain('12:00');
    });
  });

  // GET /api/reservations/blocked-times - Oak Tavern real-world scenario
  describe('GET /api/reservations/blocked-times - Oak Tavern scenario', () => {
    it('lunch cluster - slots within window are blocked for large groups', async () => {
      await seedTenant({ max_covers: 10, concurrent_guests_time_limit: 120 });
      await seedReservation({ id: RES_ID, reservation_date: '2099-06-15', reservation_time: '13:00', guests: 4 });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000020',
        reservation_date: '2099-06-15',
        reservation_time: '13:30',
        guests: 4,
      });
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=3`,
      );
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.blocked_times).toContain('13:00'); // 4+4+3=11 > 10
      expect(body.blocked_times).toContain('13:30');
      expect(body.blocked_times).toContain('14:00'); // within 120 min of both bookings: 4+4+3=11 > 10
    });

    it('lunch cluster - slots within window are OK for small groups (1 guest)', async () => {
      await seedTenant({ max_covers: 10, concurrent_guests_time_limit: 120 });
      await seedReservation({ id: RES_ID, reservation_date: '2099-06-15', reservation_time: '13:00', guests: 4 });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000020',
        reservation_date: '2099-06-15',
        reservation_time: '13:30',
        guests: 4,
      });
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=1`,
      );
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.blocked_times).not.toContain('13:00'); // 4+4+1=9 <= 10
      expect(body.blocked_times).not.toContain('13:30');
    });

    it('evening slots are not affected by lunch cluster', async () => {
      await seedTenant({ max_covers: 10, concurrent_guests_time_limit: 120 });
      await seedReservation({ id: RES_ID, reservation_date: '2099-06-15', reservation_time: '13:00', guests: 4 });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000020',
        reservation_date: '2099-06-15',
        reservation_time: '13:30',
        guests: 4,
      });
      const res = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=3`,
      );
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.blocked_times).not.toContain('16:00'); // 180 min from 13:00, 150 min from 13:30 - both ≥ 120
      expect(body.blocked_times).not.toContain('19:00');
      expect(body.blocked_times).not.toContain('20:00');
    });

    it('multiple reservations pushed close to limit - exact boundary', async () => {
      await seedTenant({ max_covers: 10, concurrent_guests_time_limit: 120 });
      await seedReservation({ id: RES_ID, reservation_date: '2099-06-15', reservation_time: '13:00', guests: 4 });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000020',
        reservation_date: '2099-06-15',
        reservation_time: '13:30',
        guests: 3,
      });
      await seedReservation({
        id: '00000000-0000-4000-8000-000000000021',
        reservation_date: '2099-06-15',
        reservation_time: '14:00',
        guests: 2,
      });
      // 4+3+2=9 concurrent; 9+1=10 which is NOT > 10 - should NOT be blocked
      const resA = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=1`,
      );
      const bodyA = (await resA.json()) as any;
      expect(resA.status).toBe(200);
      expect(bodyA.blocked_times).not.toContain('13:30');
      // 4+3+2=9 concurrent; 9+2=11 > 10 - should be blocked
      const resB = await exports.default.fetch(
        `http://localhost/api/reservations/blocked-times?tenant_id=${TENANT_ID}&date=2099-06-15&guests=2`,
      );
      const bodyB = (await resB.json()) as any;
      expect(resB.status).toBe(200);
      expect(bodyB.blocked_times).toContain('13:30');
    });
  });
});
