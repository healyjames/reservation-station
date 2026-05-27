export type BookingStep = 'calendar' | 'form-step1' | 'form-step2' | 'success';

export interface BookingFormData {
  guests: number;
  time: string;
  firstName: string;
  surname: string;
  email: string;
  telephone: string;
  dietary: string;
}

export interface BookingRequest {
  tenant_id: string;
  first_name: string;
  surname: string;
  telephone: string;
  email: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  dietary_requirements?: string;
}
