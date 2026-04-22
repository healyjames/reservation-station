import { MiddlewareHandler } from 'hono';
import { verifyJWT } from '../utils/auth';

export const adminAuth: MiddlewareHandler<{ Bindings: Env; Variables: { userId: string; tenantId: string } }> =
	async (c, next) => {
		const authHeader = c.req.header('Authorization');
		if (!authHeader?.startsWith('Bearer ')) {
			return c.json({ success: false, error: 'Unauthorized' }, 401);
		}
		const token = authHeader.slice(7);
		const payload = await verifyJWT(token, c.env.JWT_SECRET);
		if (!payload) {
			return c.json({ success: false, error: 'Unauthorized' }, 401);
		}
		c.set('userId', payload.userId);
		c.set('tenantId', payload.tenantId);
		await next();
	};
