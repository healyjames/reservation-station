import { env, exports } from 'cloudflare:workers';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const RES_ID = '00000000-0000-4000-8000-000000000099';

// Build a test env whose EMAIL binding is a mock, so sends never hit the real
// service and failures can be simulated deterministically.
function envWith(send: ReturnType<typeof vi.fn>) {
  return { ...env, EMAIL: { send } } as unknown as typeof env;
}

const failingSend = () => vi.fn().mockRejectedValue(Object.assign(new Error('email down'), { code: 'E_SEND' }));
const okSend = () => vi.fn().mockResolvedValue({ messageId: 'test' });

async function seedTenantWithEmail(contactEmail: string | null = 'owner@restaurant.com') {
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit, contact_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(TENANT_ID, 'Test Restaurant', 'test-restaurant', 50, 20, 'active', 120, contactEmail)
    .run();
}

async function seedReservation() {
  const now = new Date().toISOString();
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Reservations
      (id, tenant_id, first_name, surname, telephone, email, reservation_date, reservation_time, guests, dietary_requirements, created_date, modified_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(RES_ID, TENANT_ID, 'Jane', 'Doe', '07700900000', 'jane@example.com', '2099-07-15', '19:00', 2, null, now, now)
    .run();
}

async function clearDb() {
  await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run();
  await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run();
}

describe('Email notifications — fire-and-forget resilience', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('POST /api/reservations returns 201 even when the email send fails', async () => {
    await seedTenantWithEmail('owner@restaurant.com');

    const res = await exports.fetch(
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
      envWith(failingSend()),
    );

    expect(res.status).toBe(201);
  });

  it('POST /api/reservations sends from EMAIL_FROM_ADDRESS with tenant contact_email as replyTo', async () => {
    await seedTenantWithEmail('owner@restaurant.com');
    const send = okSend();

    const res = await exports.fetch(
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
      envWith(send),
    );

    expect(res.status).toBe(201);
    // customer + tenant emails
    expect(send).toHaveBeenCalledTimes(2);
    for (const call of send.mock.calls) {
      const msg = call[0] as { from: string; replyTo?: string };
      expect(msg.from).toContain(`<${env.EMAIL_FROM_ADDRESS}>`);
      expect(msg.from).not.toContain('owner@restaurant.com');
      expect(msg.replyTo).toBe('owner@restaurant.com');
    }
  });

  it('POST /api/reservations returns 201 when tenant has no contact_email', async () => {
    await seedTenantWithEmail(null);

    const res = await exports.fetch(
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
      envWith(okSend()),
    );

    expect(res.status).toBe(201);
  });

  it('PATCH /api/reservations/:id returns 200 even when the email send fails', async () => {
    await seedTenantWithEmail('owner@restaurant.com');
    await seedReservation();

    const res = await exports.fetch(
      new Request(`http://localhost/api/reservations/${RES_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: 3 }),
      }),
      envWith(failingSend()),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  });

  it('DELETE /api/reservations/:id returns 200 even when the email send fails', async () => {
    await seedTenantWithEmail('owner@restaurant.com');
    await seedReservation();

    const res = await exports.fetch(
      new Request(`http://localhost/api/reservations/${RES_ID}`, {
        method: 'DELETE',
      }),
      envWith(failingSend()),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  });

  it('DELETE /api/reservations/:id returns 404 when reservation does not exist', async () => {
    await seedTenantWithEmail('owner@restaurant.com');

    const res = await exports.fetch(
      new Request(`http://localhost/api/reservations/${RES_ID}`, {
        method: 'DELETE',
      }),
      envWith(okSend()),
    );

    expect(res.status).toBe(404);
  });
});
