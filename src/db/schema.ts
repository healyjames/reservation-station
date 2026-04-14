import z from 'zod';

export const TenantSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	tenant_code: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'tenant_code must be lowercase alphanumeric with hyphens only'),
	max_guests: z.number().int().nonnegative(),
	max_covers: z.number().int().nonnegative(),
	status: z.enum(['active', 'cancelled']),
	block_current_day: z.boolean(),
	concurrent_guests_time_limit: z.number().int().positive().default(120),
	created_date: z.string().optional(),
	modified_date: z.string().optional(),
});

export const CreateTenantSchema = TenantSchema.omit({
	id: true,
	created_date: true,
	modified_date: true,
});

export const UpdateTenantSchema = TenantSchema.omit({
	id: true,
	created_date: true,
	modified_date: true,
}).partial();

export const ReservationSchema = z.object({
	id: z.uuid(),
	tenant_id: z.uuid(),
	first_name: z.string().min(1).max(50),
	surname: z.string().min(1).max(50),
	telephone: z.string().regex(/^\+?[\d\s\-]{7,15}$/),
	email: z.email(),
	reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
	reservation_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
	guests: z.number().int().positive(),
	dietary_requirements: z.string().max(500).optional(),
	created_date: z.string().optional(),
	modified_date: z.string().optional(),
});

export const CreateReservationSchema = ReservationSchema.omit({
  id: true,
  created_date: true,
  modified_date: true,
});

export const UpdateReservationSchema = ReservationSchema.omit({
  id: true,
  tenant_id: true,
  created_date: true,
  modified_date: true,
}).partial();

export type Tenant = z.infer<typeof TenantSchema>;
export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type CreateReservation = z.infer<typeof CreateReservationSchema>;
export type UpdateReservation = z.infer<typeof UpdateReservationSchema>;

export const AdminUserSchema = z.object({
	id: z.uuid(),
	tenant_id: z.uuid(),
	email: z.email(),
	password_hash: z.string(),
	failed_attempts: z.number().int().nonnegative().default(0),
	locked_until: z.string().nullable().optional(),
	created_date: z.string().optional(),
	modified_date: z.string().optional(),
});

export const LoginSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;
export type LoginPayload = z.infer<typeof LoginSchema>;