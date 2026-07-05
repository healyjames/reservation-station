import type { Reservation } from '../schema';

/**
 * Shared backend types for the Maximum Bookings Worker.
 *
 * Rule of thumb:
 *  - Types used in two or more files across different directories live here.
 *  - Types inferred from Zod schemas stay in src/db/schema.ts (co-located with their schema).
 *  - Frontend types stay in src/frontend/shared/types/ (accessed via the @shared/types alias).
 *  - Component prop types and hook-local types stay in their own files.
 */

// ─── Route Types ──────────────────────────────────────────────────────────────
// Shared between src/routes/reservations.ts and src/routes/admin.ts.

export type ReservationWithTenant = Reservation & {
  tenant_name: string;
  contact_email: string;
};

// ─── Email Types ──────────────────────────────────────────────────────────────
// Used by src/utils/email.ts and all src/emails/* template builders.

/** Minimal subset of the Worker Env required to send email via Resend. */
export interface ResendEnv {
  RESEND_API_KEY: string;
}

/** The subject + HTML body returned by every email template builder. */
export interface EmailTemplate {
  subject: string;
  html: string;
}

/** Arguments passed to the sendEmail utility. */
export interface SendEmailRequest {
  to: string;
  from: string;
  reply_to?: string;
  subject: string;
  html: string;
}

/**
 * Full context object available when building any reservation-related email.
 * Includes both tenant and customer data; template builders pick what they need.
 */
export interface ReservationEmailContext {
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

/**
 * Data required by customer-facing email template builders
 * (confirmation, amendment, cancellation).
 */
export interface CustomerReservationEmailData {
  tenantName: string;
  firstName: string;
  reservationDate: string;
  reservationTime: string;
  guests: number;
  dietaryRequirements: string | null;
  /** Present when manage/cancel links should be included in the email. */
  reservationId?: string;
  customerEmail?: string;
  baseUrl?: string;
  manageToken?: string;
}

/**
 * Data required by tenant-facing email template builders
 * (confirmation, amendment, cancellation).
 */
export interface TenantReservationEmailData {
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

// ─── Slot / Availability Types ────────────────────────────────────────────────
// Shared between src/utils/slots.ts and src/routes/reservations.ts.

/** Minimal reservation shape used for concurrent-guest capacity calculations. */
export type SlotReservation = { reservation_time: string; guests: number };

// ─── Auth / JWT Types ─────────────────────────────────────────────────────────
// Shared between src/utils/auth.ts and src/middleware/adminAuth.ts.

/** Claims encoded in the admin JWT and returned by verifyJWT. */
export type JwtPayload = { userId: string; tenantId: string };
