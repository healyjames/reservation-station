export type SlotReservation = { reservation_time: string; guests: number };

export function toMinutes(time: string): number {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
}

export function generateTimeSlots(openTime = '12:00', closeTime = '22:00'): string[] {
	const slots: string[] = [];
	const open = toMinutes(openTime);
	const close = toMinutes(closeTime);
	for (let m = open; m < close; m += 30) {
		const hour = Math.floor(m / 60).toString().padStart(2, '0');
		const min = (m % 60).toString().padStart(2, '0');
		slots.push(`${hour}:${min}`);
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
