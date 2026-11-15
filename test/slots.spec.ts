import { describe, it, expect } from 'vitest';
import { peakConcurrentGuests, isTimeInBlock, isTimeInAnyBlock } from '../src/utils/slots';

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

describe('isTimeInBlock', () => {
  const block = { start_time: '14:00', end_time: '16:00' };

  it('is true at the start time (inclusive)', () => {
    expect(isTimeInBlock('14:00', block)).toBe(true);
  });

  it('is true for a time inside the range', () => {
    expect(isTimeInBlock('15:30', block)).toBe(true);
  });

  it('is false at the end time (exclusive)', () => {
    expect(isTimeInBlock('16:00', block)).toBe(false);
  });

  it('is false before the start and after the end', () => {
    expect(isTimeInBlock('13:30', block)).toBe(false);
    expect(isTimeInBlock('16:30', block)).toBe(false);
  });

  it('never matches a full-day row (no times)', () => {
    expect(isTimeInBlock('15:00', { start_time: null, end_time: null })).toBe(false);
  });

  it('treats a legacy row with end before start as wrapping past midnight', () => {
    const wrap = { start_time: '22:00', end_time: '02:00' };
    expect(isTimeInBlock('23:00', wrap)).toBe(true);
    expect(isTimeInBlock('01:30', wrap)).toBe(true);
    expect(isTimeInBlock('02:00', wrap)).toBe(false);
    expect(isTimeInBlock('21:30', wrap)).toBe(false);
  });

  it('treats a legacy row with equal start and end as covering the whole day', () => {
    expect(isTimeInBlock('09:00', { start_time: '14:00', end_time: '14:00' })).toBe(true);
  });
});

describe('isTimeInAnyBlock', () => {
  const blocks = [
    { start_time: '12:00', end_time: '13:00' },
    { start_time: null, end_time: null },
    { start_time: '18:00', end_time: '20:00' },
  ];

  it('is true when any block contains the time', () => {
    expect(isTimeInAnyBlock('12:30', blocks)).toBe(true);
    expect(isTimeInAnyBlock('19:30', blocks)).toBe(true);
  });

  it('is false in the gap between blocks', () => {
    expect(isTimeInAnyBlock('15:00', blocks)).toBe(false);
  });

  it('is false with no blocks', () => {
    expect(isTimeInAnyBlock('15:00', [])).toBe(false);
  });
});
