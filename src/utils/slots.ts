export type SlotReservation = { reservation_time: string; guests: number };

export function toMinutes(time: string): number {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
}

export function generateTimeSlots(): string[] {
	const slots: string[] = [];
	for (let hour = 12; hour <= 21; hour++) {
		slots.push(`${hour.toString().padStart(2, '0')}:00`);
		slots.push(`${hour.toString().padStart(2, '0')}:30`);
	}
	return slots;
}

export function calculateConcurrentGuests(
	slotTime: string,
	reservations: SlotReservation[],
	timeLimitMinutes: number,
): number {
	const slotMinutes = toMinutes(slotTime);
	return reservations.reduce((sum, r) => {
		const diff = Math.abs(slotMinutes - toMinutes(r.reservation_time));
		return diff < timeLimitMinutes ? sum + r.guests : sum;
	}, 0);
}
