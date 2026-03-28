export interface Tenant {
	id: string;
	name: string;
	max_guests: number;
	max_covers: number;
	status: 'active' | 'cancelled';
	block_current_day: boolean;
}

export interface Reservation {
	id: string;
	tenant_id: string;
	first_name: string;
	surname: string;
	telephone: string;
	email: string;
	reservation_date: string; // YYYY-MM-DD
	reservation_time: string; // HH:MM
	guests: number;
	dietary_requirements?: string;
	created_date?: string;
	modified_date?: string;
}

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