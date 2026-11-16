import { env, exports } from 'cloudflare:workers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateManageToken, hashManageToken } from '../src/utils/manageToken';

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const RES_ID = '00000000-0000-4000-8000-000000000099';
const RES_EMAIL = 'jane@example.com';

async function seedTenantWithEmail(contactEmail: string | null = 'owner@restaurant.com') {
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit, contact_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(TENANT_ID, 'Test Restaurant', 'test-restaurant', 50, 20, 'active', 120, contactEmail)
    .run();
}

/** Seeds a reservation and returns the customer manage URL query (email + token) for it. */
async function seedReservation(): Promise<string> {
  const now = new Date().toISOString();
  const token = await generateManageToken(env.JWT_SECRET, RES_ID, RES_EMAIL);
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Reservations
      (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements, created_date, modified_date, manage_token_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      RES_ID,
      TENANT_ID,
      'Jane',
      'Doe',
      '07700900000',
      RES_EMAIL,
      '2099-07-15',
      '19:00',
      2,
      null,
      now,
      now,
      await hashManageToken(token),
    )
    .run();
  return `email=${encodeURIComponent(RES_EMAIL)}&token=${token}`;
}

async function clearDb() {
  await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run();
  await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run();
}

describe('Email notifications — fire-and-forget resilience', () => {
  beforeEach(async () => {
    await clearDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POST /api/reservations returns 201 even when Resend API call fails', async () => {
    await seedTenantWithEmail('owner@restaurant.com');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Resend network error')));

    const res = await exports.default.fetch(
      new Request('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          first_name: 'Jane',
          surname: 'Doe',
          telephone: '07700900000',
          email: 'jane@example.com',
          reservation_date: '2099-07-15',
          reservation_time: '19:00',
          guests: 2,
        }),
      }),
    );

    expect(res.status).toBe(201);
  });

  it('POST /api/reservations returns 201 when tenant has no contact_email', async () => {
    await seedTenantWithEmail(null);

    const res = await exports.default.fetch(
      new Request('http://localhost/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          first_name: 'Jane',
          surname: 'Doe',
          telephone: '07700900000',
          email: 'jane@example.com',
          reservation_date: '2099-07-15',
          reservation_time: '19:00',
          guests: 2,
        }),
      }),
    );

    expect(res.status).toBe(201);
  });

  it('PATCH /api/reservations/:id returns 200 even when Resend API call fails', async () => {
    await seedTenantWithEmail('owner@restaurant.com');
    const manageQuery = await seedReservation();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Resend network error')));

    const res = await exports.default.fetch(
      new Request(`http://localhost/api/reservations/${RES_ID}?${manageQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: 3 }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  });

  it('DELETE /api/reservations/:id returns 200 even when Resend API call fails', async () => {
    await seedTenantWithEmail('owner@restaurant.com');
    const manageQuery = await seedReservation();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Resend network error')));

    const res = await exports.default.fetch(
      new Request(`http://localhost/api/reservations/${RES_ID}?${manageQuery}`, {
        method: 'DELETE',
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  });

  it('DELETE /api/reservations/:id returns 404 when reservation does not exist', async () => {
    await seedTenantWithEmail('owner@restaurant.com');

    const res = await exports.default.fetch(
      new Request(`http://localhost/api/reservations/${RES_ID}?email=${encodeURIComponent(RES_EMAIL)}&token=x`, {
        method: 'DELETE',
      }),
    );

    expect(res.status).toBe(404);
  });
});
