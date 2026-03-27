import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import tenants from './routes/tenants';
import reservations from './routes/reservations';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('/api/*', cors());

app.get('/message', (c) => c.text('Welcome to the Restaurant Booking API'));

app.route('/api/tenants', tenants);
app.route('/api/reservations', reservations);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default app;