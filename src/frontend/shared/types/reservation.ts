export interface Reservation {
  id: string;
  tenant_id: string;
  first_name: string;
  surname: string;
  telephone: string;
  email: string;
  /** ISO date string: YYYY-MM-DD */
  reservation_date: string;
  /** HH:MM */
  reservation_time: string;
  guests: number;
  dietary_requirements?: string;
  created_date?: string;
  modified_date?: string;
}

export interface CreateReservationPayload {
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
