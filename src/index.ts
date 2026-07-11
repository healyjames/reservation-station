import app from './app';
import { runMonthlyExport } from './cron/monthly-export';

export default {
  // HTTP requests are handled by the Hono app (wrapped so `this` binding is never an issue).
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),

  // Cron Triggers (see wrangler.jsonc "triggers.crons") invoke this on a schedule.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // waitUntil keeps the Worker alive until the export + email finish.
    ctx.waitUntil(runMonthlyExport(env));
  },
};

