import { MiddlewareHandler } from 'hono';

/** Constant-time string comparison to prevent timing side-channel attacks on the API key. */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

export const superAdminAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
	const expectedKey = c.env.SUPER_ADMIN_KEY;
	if (!expectedKey) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	const key = c.req.header('X-Admin-Key');
	if (!key || !timingSafeEqual(key, expectedKey)) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	await next();
};
