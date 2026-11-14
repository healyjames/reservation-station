import { describe, it, expect } from 'vitest';
import { peakConcurrentGuests } from '../src/utils/slots';

const LIMIT = 120;
const at = (reservation_time: string, guests: number) => ({ reservation_time, guests });

describe('peakConcurrentGuests', () => {
  it('returns 0 when there are no reservations', () => {
    expect(peakConcurrentGuests('13:00', [], LIMIT)).toBe(0);
  });

  it('counts bookings already seated at the start', () => {
    expect(peakConcurrentGuests('13:00', [at('12:00', 4)], LIMIT)).toBe(4);
  });

  it('counts a booking that starts later inside the sitting', () => {
    expect(peakConcurrentGuests('13:00', [at('14:50', 8)], LIMIT)).toBe(8);
  });

  it('ignores a booking that starts exactly when the sitting ends', () => {
    expect(peakConcurrentGuests('13:00', [at('15:00', 8)], LIMIT)).toBe(0);
  });

  it('ignores a booking whose sitting ended exactly at the start', () => {
    expect(peakConcurrentGuests('13:00', [at('11:00', 8)], LIMIT)).toBe(0);
  });

  it('returns the highest overlap, not the sum of every booking in the window', () => {
    // 12:00 (4) leaves at 14:00; 13:30 (3) and 14:30 (5) overlap from 14:30. Peak is 3 + 5 = 8.
    expect(peakConcurrentGuests('13:00', [at('12:00', 4), at('13:30', 3), at('14:30', 5)], LIMIT)).toBe(8);
  });
});
