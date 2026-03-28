import z from 'zod';

export const TenantSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	max_guests: z.number().int().positive(),
	max_covers: z.number().int().positive(),
	status: z.enum(['active', 'cancelled']),
	block_current_day: z.boolean(),
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

export const TENANT_UPDATABLE_FIELDS: (keyof Tenant)[] = ['name', 'max_guests', 'max_covers', 'status', 'block_current_day'];

export const RESERVATION_UPDATABLE_FIELDS: (keyof Reservation)[] = [
	'first_name',
	'surname',
	'telephone',
	'email',
	'reservation_date',
	'reservation_time',
	'guests',
	'dietary_requirements',
];
