import { toMinutes } from '../utils/slots';

/** Minutes since midnight for a `reservation_time` column ("HH:MM"). */
const START_MINUTES = (col: string) => `(CAST(SUBSTR(${col}, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(${col}, 4, 2) AS INTEGER))`;

type CapacityGuardInput = {
  tenantId: string;
  date: string;
  /** Start of the booking being created or moved, "HH:MM". */
  time: string;
  guests: number;
  maxCovers: number;
  timeLimitMinutes: number;
  /** Reservation to leave out of the count (the one being amended). */
  excludeId?: string;
};

/**
 * SQL condition (plus its bind values) that is true when a booking of `guests` at `time` fits the
 * venue for its whole sitting `[time, time + timeLimitMinutes)`.
 *
 * Occupancy only rises when a booking starts, so the peak inside the sitting is at the new start or
 * at an existing booking's start that falls inside the sitting. Each of those points is checked.
 * `maxCovers = 0` means unlimited. Meant to be embedded in an INSERT ... SELECT / UPDATE WHERE so the
 * check and the write happen in one statement (no read-then-write race).
 */
export function capacityGuard(input: CapacityGuardInput): { sql: string; binds: (string | number)[] } {
  const start = toMinutes(input.time);
  const end = start + input.timeLimitMinutes;
  const exclude = input.excludeId ? 'AND id != ?' : '';
  const excludeBind = input.excludeId ? [input.excludeId] : [];

  const sql = `((? = 0) OR NOT EXISTS (
    SELECT 1 FROM (
      SELECT ? AS p
      UNION
      SELECT ${START_MINUTES('reservation_time')} FROM Reservations
       WHERE tenant_id = ? AND reservation_date = ? ${exclude}
         AND ${START_MINUTES('reservation_time')} > ? AND ${START_MINUTES('reservation_time')} < ?
    ) AS points
    WHERE (
      SELECT COALESCE(SUM(guests), 0) FROM Reservations
       WHERE tenant_id = ? AND reservation_date = ? ${exclude}
         AND ${START_MINUTES('reservation_time')} <= points.p
         AND ${START_MINUTES('reservation_time')} + ? > points.p
    ) + ? > ?
  ))`;

  const binds = [
    input.maxCovers,
    start,
    input.tenantId,
    input.date,
    ...excludeBind,
    start,
    end,
    input.tenantId,
    input.date,
    ...excludeBind,
    input.timeLimitMinutes,
    input.guests,
    input.maxCovers,
  ];
  return { sql, binds };
}
