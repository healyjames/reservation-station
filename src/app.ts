import { Hono } from 'hono';
import { cors } from 'hono/cors';
import tenants from './routes/tenants';
import reservations from './routes/reservations';

const app = new Hono();

app.use('/api/*', cors());

app.route('/api/tenants', tenants);
app.route('/api/reservations', reservations);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default app;
