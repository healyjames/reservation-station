/** A `BlockedDates` row as returned by the admin API. Both times are null for a full-day block. */
export type AdminBlockedDate = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason?: string | null;
};

/** A time-range block the admin wants to add to the visible day. */
export type TimeBlockInput = {
  start_time: string;
  end_time: string;
  reason?: string;
};
