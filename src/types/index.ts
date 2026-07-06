import type { Reservation } from '../schema';

export type ReservationWithTenant = Reservation & {
  tenant_name: string;
  contact_email: string;
};

export type ResendEnv = {
  RESEND_API_KEY: string;
}

export type EmailTemplate = {
  subject: string;
  html: string;
}

export type SendEmailRequest = {
  to: string;
  from: string;
  reply_to?: string;
  subject: string;
  html: string;
}

export type ReservationEmailContext = {
  reservationId: string;
  tenantId: string;
  tenantName: string;
  tenantContactEmail: string | null;
  firstName: string;
  surname: string;
  telephone: string;
  customerEmail: string;
  reservationDate: string;
  reservationTime: string;
  guests: number;
  dietaryRequirements: string | null;
}

export type CustomerReservationEmailData = {
  tenantName: string;
  firstName: string;
  reservationDate: string;
  reservationTime: string;
  guests: number;
  dietaryRequirements: string | null;
  reservationId?: string;
  customerEmail?: string;
  baseUrl?: string;
  manageToken?: string;
}

export type TenantReservationEmailData = {
  tenantName: string;
  reservationId: string;
  firstName: string;
  surname: string;
  telephone: string;
  customerEmail: string;
  reservationDate: string;
  reservationTime: string;
  guests: number;
  dietaryRequirements: string | null;
}

export type SlotReservation = { reservation_time: string; guests: number };

export type JwtPayload = { userId: string; tenantId: string };
