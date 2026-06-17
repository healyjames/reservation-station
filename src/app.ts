import { Hono } from 'hono';
import { cors } from 'hono/cors';
import tenants from './routes/tenants';
import reservations from './routes/reservations';
import auth from './routes/auth';
import admin from './routes/admin';
import blockedDates from './routes/blocked-dates';
import openingHours from './routes/opening-hours';

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors({
  origin: (origin, c) => {
    if (!origin) return null;
    // Development: allow all origins (localhost, dev servers)
    if (c.env.ENVIRONMENT === 'development') return origin;
    // Production: allow any HTTPS origin so the widget can be embedded on any restaurant website.
    // Security is enforced by route-level credentials (admin JWT / manage token), not origin-checking.
    return origin.startsWith('https://') ? origin : null;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

app.route('/api/tenants', tenants);
app.route('/api/reservations', reservations);
app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.route('/api/admin/blocked-dates', blockedDates);
app.route('/api/admin/opening-hours', openingHours);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default app;
