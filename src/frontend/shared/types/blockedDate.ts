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

/** A `DateOverrides` row: special opening hours for one date. Times are null when `is_closed` is 1. */
export type AdminDateOverride = {
  id: string;
  date: string;
  is_closed: 0 | 1;
  open_time: string | null;
  close_time: string | null;
  reason?: string | null;
};

/** Special opening hours the admin wants to set for one date. */
export type SpecialHoursInput = {
  open_time: string;
  close_time: string;
  reason?: string;
};
