import { z } from 'zod';

export const TenantSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  tenant_code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'tenant_code must be lowercase alphanumeric with hyphens only'),
  max_guests: z.number().int().nonnegative(),
  max_covers: z.number().int().nonnegative(),
  status: z.enum(['active', 'cancelled']),
  concurrent_guests_time_limit: z.number().int().positive().default(120),
  contact_email: z.email(),
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

export type Tenant = z.infer<typeof TenantSchema>;
export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;

export const ReservationSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  first_name: z.string().min(1).max(50),
  surname: z.string().min(1).max(50),
  telephone: z.string().regex(/^\+?[\d\s\-]{7,15}$/),
  email: z.email(),
  reservation_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine((v) => !isNaN(new Date(v).getTime()), 'Invalid date (e.g. month or day out of range)'),
  reservation_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)'),
  guests: z.number().int().positive(),
  dietary_requirements: z.string().max(500).optional(),
  created_date: z.string().optional(),
  modified_date: z.string().optional(),
});

export const CreateReservationSchema = ReservationSchema.omit({
  id: true,
  created_date: true,
  modified_date: true,
}).superRefine((data, ctx) => {
  const today = new Date().toISOString().split('T')[0];
  if (data.reservation_date < today) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reservation_date'], message: 'Reservation date must not be in the past' });
  }
});

export const UpdateReservationSchema = ReservationSchema.omit({
  id: true,
  tenant_id: true,
  created_date: true,
  modified_date: true,
}).partial();

export type Reservation = z.infer<typeof ReservationSchema>;
export type CreateReservation = z.infer<typeof CreateReservationSchema>;
export type UpdateReservation = z.infer<typeof UpdateReservationSchema>;

export const BlockedDateSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)')
    .nullable(),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)')
    .nullable(),
  reason: z.string().nullable(),
  created_date: z.string().optional(),
});

export const CreateBlockedDateSchema = BlockedDateSchema.omit({
  id: true,
  created_date: true,
});

export type BlockedDate = z.infer<typeof BlockedDateSchema>;
export type CreateBlockedDate = z.infer<typeof CreateBlockedDateSchema>;

export const OpeningHoursEntrySchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  day_of_week: z.number().int().min(0).max(6),
  is_closed: z.union([z.boolean(), z.literal(0), z.literal(1)]),
  open_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  close_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
});

export const UpsertOpeningHoursSchema = z
  .array(
    z.object({
      day_of_week: z.number().int().min(0).max(6),
      is_closed: z.union([z.boolean(), z.literal(0), z.literal(1)]),
      open_time: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .nullable()
        .optional(),
      close_time: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .nullable()
        .optional(),
    }),
  )
  .length(7)
  .refine((rows) => new Set(rows.map((r) => r.day_of_week)).size === rows.length, {
    message: 'Each day_of_week (0–6) must appear exactly once',
  });

export type OpeningHoursEntry = z.infer<typeof OpeningHoursEntrySchema>;

const CreateAdminUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const OnboardingOpeningHoursSchema = UpsertOpeningHoursSchema.superRefine((rows, ctx) => {
  rows.forEach((entry, index) => {
    const isClosed = entry.is_closed === true || entry.is_closed === 1;
    if (isClosed) return;
    if (entry.open_time != null && entry.close_time != null) return;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [index],
      message: 'open_time and close_time are required when day is not closed',
    });
  });
});

export const CreateTenantWithAdminSchema = z.object({
  tenant: CreateTenantSchema,
  admin: CreateAdminUserSchema,
  opening_hours: OnboardingOpeningHoursSchema.optional(),
});

export type CreateTenantWithAdmin = z.infer<typeof CreateTenantWithAdminSchema>;

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

export const BlockDateBodySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)')
      .optional(),
    end_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)')
      .optional(),
    reason: z.string().optional(),
  })
  .refine((d) => (d.start_time == null) === (d.end_time == null), {
    message: 'start_time and end_time must both be provided or both be omitted',
  });

export const CreateAdminReservationSchema = z.object({
  first_name: z.string().min(1).max(50),
  surname: z.string().min(1).max(50),
  telephone: z.string().optional().default(''),
  email: z.string().optional().default(''),
  reservation_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => !isNaN(new Date(v).getTime()), 'Invalid date (e.g. month or day out of range)'),
  reservation_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  guests: z.number().int().positive(),
  dietary_requirements: z.string().max(500).optional().default(''),
});
