export interface BlockedDatesResponse {
  blocked_dates: string[];
}

export interface BlockedTimesResponse {
  blocked_times: string[];
}

export interface DailyCapacityResponse {
  max_covers: number;
  booked_covers: number;
  remaining_covers: number | null;
}
