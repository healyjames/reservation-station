import { Hono } from 'hono';
import { cors } from 'hono/cors';
import tenants from './routes/tenants';
import reservations from './routes/reservations';
import auth from './routes/auth';
import admin from './routes/admin';
import blockedDates from './routes/blocked-dates';
import openingHours from './routes/opening-hours';

const whitelist = ['https://maximum-bookings.jameshealydesign.workers.dev'];

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors({
  origin: (origin, c) => {
    if (c.env.ENVIRONMENT === 'development') {
      whitelist.push('http://localhost:8787', 'http://localhost:3000', 'http://localhost:5173');
    }
    return whitelist.includes(origin) ? origin : null;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
