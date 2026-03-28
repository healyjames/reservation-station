import z from 'zod';

export const TenantSchema = z.object({
	id: z.string(),
	name: z.string(),
	max_guests: z.number().int().nonnegative(),
	max_covers: z.number().int().nonnegative(),
	status: z.enum(['active', 'cancelled']),
	block_current_day: z.boolean(),
});

export const ReservationSchema = z.object({
	id: z.string(),
	tenant_id: z.string(),
	first_name: z.string(),
	surname: z.string(),
	telephone: z.string(),
	email: z.string(),
	reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
	reservation_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
	guests: z.number().int().positive(),
	dietary_requirements: z.string().optional(),
	created_date: z.string().optional(),
	modified_date: z.string().optional(),
});

export type Tenant = z.infer<typeof TenantSchema>;
export type Reservation = z.infer<typeof ReservationSchema>;

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
