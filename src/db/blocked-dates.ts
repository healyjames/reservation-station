import { isTimeInAnyBlock } from '../utils/slots';

type BlockCheckInput = {
  db: D1Database;
  tenantId: string;
  date: string;
  time: string;
};

/**
 * The customer-facing reason a booking at `date`/`time` is not allowed by the tenant's blocked dates,
 * or `null` when no block covers it. A full-day block wins over partial ones.
 */
export async function findBlockError({ db, tenantId, date, time }: BlockCheckInput): Promise<string | null> {
  const { results: blocks } = await db
    .prepare('SELECT start_time, end_time FROM BlockedDates WHERE tenant_id = ? AND date = ?')
    .bind(tenantId, date)
    .run<{ start_time: string | null; end_time: string | null }>();

  if (blocks.some((block) => block.start_time === null)) return 'Bookings are not available for this date';
  if (isTimeInAnyBlock(time, blocks)) return 'Bookings are not available for this time';
  return null;
}
