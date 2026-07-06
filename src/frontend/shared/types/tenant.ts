export type TenantStatus = 'active' | 'cancelled';

export type ThemeName = string;
export type ThemeMode = 'light' | 'dark';

export type OpeningHoursEntry = {
  id: string;
  tenant_id: string;
  /** 0 = Sunday, 1 = Monday, ... 6 = Saturday (JS Date.getUTCDay() convention) */
  day_of_week: number;
  /** D1 returns 0/1 integers; normalise to boolean before use */
  is_closed: boolean | 0 | 1;
  open_time: string | null;
  close_time: string | null;
}

export type TenantConfig = {
  id: string;
  name: string;
  tenant_code: string;
  max_guests: number;
  max_covers: number;
  status: TenantStatus;
  concurrent_guests_time_limit: number;
  contact_email?: string;
  created_date?: string;
  modified_date?: string;
  opening_hours: OpeningHoursEntry[] | null;
}
