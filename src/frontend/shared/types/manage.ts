import type { Reservation, TenantConfig, CalendarDate } from '@shared/types';

export type ManageView =
  | 'loading'
  | 'error'
  | 'overview'
  | 'edit-details'
  | 'change-datetime'
  | 'cancel-confirm'
  | 'success-edit'
  | 'success-cancel';

export interface EditData {
  first_name: string;
  surname: string;
  telephone: string;
  email: string;
  dietary_requirements: string;
  guests: number;
}
