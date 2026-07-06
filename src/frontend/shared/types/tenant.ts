export type TenantStatus = 'active' | 'cancelled';

export type ThemeName = string; // tenant_code used as CSS class/theme identifier
export type ThemeMode = 'light' | 'dark';

export type OpeningHoursEntry = {
  id: string;
  tenant_id: string;
  /** 0 = Sunday, 1 = Monday, ... 6 = Saturday (JS Date.getUTCDay() convention) */
  day_of_week: number;
  /** D1 returns 0/1 integers; normalise to boolean before use */
  is_closed: boolean | 0 | 1;
  open_time: string | null; // "HH:MM"
  close_time: string | null; // "HH:MM"
}

export type TenantConfig = {
  id: string;
  name: string;
  tenant_code: string;
  max_guests: number;
  max_covers: number;
  status: TenantStatus;
  concurrent_guests_time_limit: number;
  /** Present when loaded via admin-authenticated endpoints (e.g. GET /api/admin/me).
   *  Intentionally absent from the public GET /api/tenants/:id widget endpoint. */
  contact_email?: string;
  created_date?: string;
  modified_date?: string;
  /** Null when no opening hours configured */
  opening_hours: OpeningHoursEntry[] | null;
}
