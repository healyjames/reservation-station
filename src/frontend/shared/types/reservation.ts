export type Reservation = {
  id: string;
  tenant_id: string;
  first_name: string;
  surname: string;
  telephone: string;
  email: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  dietary_requirements?: string;
  created_date?: string;
  modified_date?: string;
}

export type CreateReservationPayload = {
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
