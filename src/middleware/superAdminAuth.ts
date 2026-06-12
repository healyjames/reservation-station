import { MiddlewareHandler } from 'hono';

export const superAdminAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
	const expectedKey = c.env.SUPER_ADMIN_KEY;
	if (!expectedKey) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	const key = c.req.header('X-Admin-Key');
	if (!key || key !== expectedKey) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	await next();
};
