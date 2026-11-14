import type { SlotReservation } from '../types';
import { DEFAULT_OPEN_TIME, DEFAULT_CLOSE_TIME, SLOT_INTERVAL_MINUTES } from '../constants';

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function generateTimeSlots(openTime = DEFAULT_OPEN_TIME, closeTime = DEFAULT_CLOSE_TIME): string[] {
  const slots: string[] = [];
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  for (let m = open; m < close; m += SLOT_INTERVAL_MINUTES) {
    const hour = Math.floor(m / 60)
      .toString()
      .padStart(2, '0');
    const min = (m % 60).toString().padStart(2, '0');
    slots.push(`${hour}:${min}`);
  }
  return slots;
}

export function calculateConcurrentGuests(slotTime: string, reservations: SlotReservation[], timeLimitMinutes: number): number {
  const slotMinutes = toMinutes(slotTime);
  return reservations.reduce((sum, r) => {
    const rMin = toMinutes(r.reservation_time);
    // A reservation at rMin occupies [rMin, rMin + timeLimitMinutes).
    // Only count it if the slot falls within that window.
    return rMin <= slotMinutes && slotMinutes < rMin + timeLimitMinutes ? sum + r.guests : sum;
  }, 0);
}

/**
 * Highest occupancy at any moment during a sitting that starts at `startTime` and lasts
 * `timeLimitMinutes`. Occupancy only rises when a booking starts, so the peak is at the sitting's
 * start or at an existing booking's start inside it. Same rule as `capacityGuard` in src/db/capacity.ts.
 */
export function peakConcurrentGuests(startTime: string, reservations: SlotReservation[], timeLimitMinutes: number): number {
  const start = toMinutes(startTime);
  const end = start + timeLimitMinutes;
  const points = [startTime, ...reservations.map((r) => r.reservation_time).filter((t) => toMinutes(t) > start && toMinutes(t) < end)];
  return Math.max(...points.map((p) => calculateConcurrentGuests(p, reservations, timeLimitMinutes)));
}
