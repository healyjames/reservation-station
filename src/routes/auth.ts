import { Hono } from 'hono';
import { z } from 'zod';
import { LoginSchema } from '../db/schema';
import { verifyPassword, signJWT } from '../utils/auth';
import type { AdminUser } from '../db/schema';

const auth = new Hono<{ Bindings: Env }>();

auth.post('/login', async (c) => {
	const rawBody = await c.req.json().catch(() => null);
	const parsed = LoginSchema.safeParse(rawBody);
	if (!parsed.success) {
		return c.json({ success: false, error: z.prettifyError(parsed.error) }, 400);
	}

	const { email, password } = parsed.data;

	const user = await c.env.maximum_bookings_db
		.prepare('SELECT * FROM AdminUsers WHERE email = ?')
		.bind(email)
		.first<AdminUser>();

	if (!user) {
		return c.json({ success: false, error: 'Invalid credentials' }, 401);
	}

	// Rate limiting: check lock
	if (user.locked_until) {
		const lockedUntil = new Date(user.locked_until).getTime();
		if (lockedUntil > Date.now()) {
			return c.json({ success: false, error: 'Account temporarily locked. Try again later.' }, 429);
		}
	}

	const valid = await verifyPassword(password, user.password_hash);

	if (!valid) {
		const newAttempts = user.failed_attempts + 1;
		const shouldLock = newAttempts >= 10;
		const lockedUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

		await c.env.maximum_bookings_db
			.prepare(
				'UPDATE AdminUsers SET failed_attempts = ?, locked_until = ?, modified_date = ? WHERE id = ?',
			)
			.bind(newAttempts, lockedUntil, new Date().toISOString(), user.id)
			.run();

		return c.json({ success: false, error: 'Invalid credentials' }, 401);
	}

	// Success - reset rate limit state
	await c.env.maximum_bookings_db
		.prepare(
			'UPDATE AdminUsers SET failed_attempts = 0, locked_until = NULL, modified_date = ? WHERE id = ?',
		)
		.bind(new Date().toISOString(), user.id)
		.run();

	const tenant = await c.env.maximum_bookings_db
		.prepare('SELECT id, name, tenant_code FROM Tenants WHERE id = ?')
		.bind(user.tenant_id)
		.first<{ id: string; name: string; tenant_code: string }>();

	if (!tenant) {
		console.error('[auth] POST /login tenant missing for admin user', { userId: user.id, tenantId: user.tenant_id });
		return c.json({ success: false, error: 'Associated tenant not found' }, 500);
	}

	const token = await signJWT({ userId: user.id, tenantId: user.tenant_id }, c.env.JWT_SECRET);

	return c.json({ success: true, data: { token, tenant } });
});

export default auth;
