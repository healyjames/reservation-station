type EffectiveHoursInput = {
  db: D1Database;
  tenantId: string;
  /** YYYY-MM-DD */
  date: string;
};

export type EffectiveHours = {
  isClosed: boolean;
  /** Both null when the venue is closed, or when nothing is configured and the default hours apply. */
  openTime: string | null;
  closeTime: string | null;
};

type HoursRow = {
  override_is_closed: number | null;
  override_open: string | null;
  override_close: string | null;
  weekly_is_closed: number | null;
  weekly_open: string | null;
  weekly_close: string | null;
};

/**
 * The opening hours that apply on one date. A `DateOverrides` row for the date replaces the weekly
 * `OpeningHours` row for that weekday entirely; with neither, the venue is open on the default hours.
 */
export async function getEffectiveHours({ db, tenantId, date }: EffectiveHoursInput): Promise<EffectiveHours> {
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const row = await db
    .prepare(
      `SELECT o.is_closed AS override_is_closed, o.open_time AS override_open, o.close_time AS override_close,
              w.is_closed AS weekly_is_closed, w.open_time AS weekly_open, w.close_time AS weekly_close
         FROM (SELECT 1) AS one
         LEFT JOIN DateOverrides o ON o.tenant_id = ? AND o.date = ?
         LEFT JOIN OpeningHours w ON w.tenant_id = ? AND w.day_of_week = ?`,
    )
    .bind(tenantId, date, tenantId, dayOfWeek)
    .first<HoursRow>();

  if (row && row.override_is_closed !== null) {
    const isClosed = row.override_is_closed === 1;
    return { isClosed, openTime: isClosed ? null : row.override_open, closeTime: isClosed ? null : row.override_close };
  }

  const isClosed = row?.weekly_is_closed === 1;
  return { isClosed, openTime: isClosed ? null : (row?.weekly_open ?? null), closeTime: isClosed ? null : (row?.weekly_close ?? null) };
}
