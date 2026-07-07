import { MiddlewareHandler } from 'hono';
import { timingSafeEqual } from '../utils/auth';

export const superAdminAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const expectedKey = c.env.SUPER_ADMIN_KEY;
  if (!expectedKey) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const key = c.req.header('X-Admin-Key');
  if (!key || !timingSafeEqual(key, expectedKey)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  await next();
};
