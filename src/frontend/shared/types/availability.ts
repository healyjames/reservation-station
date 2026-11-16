export type BlockedDatesResponse = {
  blocked_dates: string[];
  closed_dates: string[];
};

export type BlockedTimesResponse = {
  blocked_times: string[];
  /** Every bookable start time on the date, from the server's effective opening hours (weekly hours or special hours). */
  slots?: string[];
};
