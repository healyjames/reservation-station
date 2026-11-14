import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateManageToken, hashManageToken } from '../src/utils/manageToken';

const TENANT_ID = '00000000-0000-4000-8000-000000001401';
const RESERVATION_ID = '00000000-0000-4000-8000-000000001501';
const UNKNOWN_RESERVATION_ID = '00000000-0000-4000-8000-000000001599';
const EMAIL = 'priya.patel@example.com';
// Customer GET needs ?email; DELETE also needs the manage token from the confirmation email.
const GET_QUERY = `email=${encodeURIComponent(EMAIL)}`;

async function seedTenant(overrides: Record<string, unknown> = {}) {
  await env.maximum_bookings_db
    .prepare(
      `INSERT OR REPLACE INTO Tenants (id, name, tenant_code, max_guests, max_covers, status, concurrent_guests_time_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id ?? TENANT_ID,
      overrides.name ?? 'Cancel Test Venue',
      overrides.tenant_code ?? 'cancel-test-venue',
      overrides.max_guests ?? 50,
      overrides.max_covers ?? 20,
      overrides.status ?? 'active',
      overrides.concurrent_guests_time_limit ?? 120,
    )
    .run();
}

/** Seeds a reservation and returns its customer manage query (`email=…&token=…`). */
async function seedReservation(overrides: Record<string, unknown> = {}): Promise<string> {
  const now = new Date().toISOString();
  const id = (overrides.id as string) ?? RESERVATION_ID;
  const token = await generateManageToken(env.JWT_SECRET, id, EMAIL);
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
      overrides.first_name ?? 'Priya',
      overrides.surname ?? 'Patel',
      overrides.telephone ?? '07700900123',
      EMAIL,
      overrides.reservation_date ?? '2099-11-18',
      overrides.reservation_time ?? '18:30',
      overrides.guests ?? 4,
      overrides.dietary_requirements ?? 'Nut allergy',
      now,
      now,
      await hashManageToken(token),
    )
    .run();
  return `${GET_QUERY}&token=${token}`;
}

async function clearDb() {
  await env.maximum_bookings_db.prepare('DELETE FROM Reservations').run();
  await env.maximum_bookings_db.prepare('DELETE FROM Tenants').run();
}

describe('Reservation cancellation API', () => {
  beforeEach(async () => {
    await clearDb();
    await seedTenant();
  });

  describe('GET /api/reservations/:id', () => {
    it('returns 200 with full reservation details for a valid, existing ID', async () => {
      await seedReservation();

      const res = await exports.default.fetch(`http://localhost/api/reservations/${RESERVATION_ID}?${GET_QUERY}`);
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        id: RESERVATION_ID,
        first_name: 'Priya',
        surname: 'Patel',
        email: 'priya.patel@example.com',
        telephone: '07700900123',
        reservation_date: '2099-11-18',
        reservation_time: '18:30',
        guests: 4,
        dietary_requirements: 'Nut allergy',
      });
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('first_name');
      expect(body).toHaveProperty('surname');
      expect(body).toHaveProperty('email');
      expect(body).toHaveProperty('telephone');
      expect(body).toHaveProperty('reservation_date');
      expect(body).toHaveProperty('reservation_time');
      expect(body).toHaveProperty('guests');
      expect(body).toHaveProperty('dietary_requirements');
    });

    it('returns 404 with Reservation not found for an unknown UUID', async () => {
      const res = await exports.default.fetch(`http://localhost/api/reservations/${UNKNOWN_RESERVATION_ID}?${GET_QUERY}`);
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(404);
      expect(body).toEqual({ error: 'Reservation not found' });
    });
  });

  describe('DELETE /api/reservations/:id', () => {
    it('returns 200 with success true for a valid, existing reservation and removes it', async () => {
      const manageQuery = await seedReservation();

      const deleteRes = await exports.default.fetch(`http://localhost/api/reservations/${RESERVATION_ID}?${manageQuery}`, {
        method: 'DELETE',
      });
      const deleteBody = (await deleteRes.json()) as Record<string, unknown>;
      const followUpGet = await exports.default.fetch(`http://localhost/api/reservations/${RESERVATION_ID}?${GET_QUERY}`);
      const followUpBody = (await followUpGet.json()) as Record<string, unknown>;

      expect(deleteRes.status).toBe(200);
      expect(deleteBody).toEqual({ success: true });
      expect(followUpGet.status).toBe(404);
      expect(followUpBody).toEqual({ error: 'Reservation not found' });
    });

    it('returns 404 with Reservation not found for an unknown UUID', async () => {
      const res = await exports.default.fetch(`http://localhost/api/reservations/${UNKNOWN_RESERVATION_ID}?${GET_QUERY}&token=x`, {
        method: 'DELETE',
      });
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(404);
      expect(body).toEqual({ error: 'Reservation not found' });
    });

    it('returns 404 on the second delete for the same reservation ID', async () => {
      const manageQuery = await seedReservation();
      const url = `http://localhost/api/reservations/${RESERVATION_ID}?${manageQuery}`;

      const firstDelete = await exports.default.fetch(url, { method: 'DELETE' });
      const secondDelete = await exports.default.fetch(url, { method: 'DELETE' });
      const secondBody = (await secondDelete.json()) as Record<string, unknown>;

      expect(firstDelete.status).toBe(200);
      expect(secondDelete.status).toBe(404);
      expect(secondBody).toEqual({ error: 'Reservation not found' });
    });
  });
});
