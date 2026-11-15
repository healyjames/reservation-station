import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateTimeSlots, getSlotsForDate, getEarliestTodaySlot, getAvailableSlots, getBlockTimeOptions } from './slots';
import type { CalendarDate } from '../types/calendar';
import type { TenantConfig } from '../types/tenant';

function makeTenant(overrides: Partial<TenantConfig> = {}): TenantConfig {
  return {
    id: 'test-id',
    name: 'Test',
    tenant_code: 'test',
    max_guests: 20,
    max_covers: 40,
    status: 'active',
    concurrent_guests_time_limit: 120,
    booking_delay_minutes: 0,
    opening_hours: null,
    ...overrides,
  };
}

describe('generateTimeSlots', () => {
  it('generates 30-minute slots from 12:00 to 14:00', () => {
    expect(generateTimeSlots('12:00', '14:00')).toEqual(['12:00', '12:30', '13:00', '13:30']);
  });

  it('handles same open and close time (empty)', () => {
    expect(generateTimeSlots('12:00', '12:00')).toEqual([]);
  });

  it('pads hours and minutes correctly', () => {
    const slots = generateTimeSlots('09:00', '09:30');
    expect(slots).toEqual(['09:00']);
  });
});

describe('getSlotsForDate', () => {
  // Monday = day_of_week 1 in JS Date.getUTCDay() convention
  // 2024-01-08 is a Monday
  const monday: CalendarDate = { year: 2024, month: 0, day: 8 };

  it('returns default slots when tenantConfig is null', () => {
    const slots = getSlotsForDate(monday, null);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toBe('12:00');
  });

  it('returns default slots when opening_hours is empty', () => {
    const tenant = makeTenant({ opening_hours: [] });
    const slots = getSlotsForDate(monday, tenant);
    expect(slots[0]).toBe('12:00');
  });

  it('returns empty array when day is closed', () => {
    const tenant = makeTenant({
      opening_hours: [{ id: '1', tenant_id: 'test-id', day_of_week: 1, is_closed: true, open_time: null, close_time: null }],
    });
    expect(getSlotsForDate(monday, tenant)).toEqual([]);
  });

  it('returns slots for open day', () => {
    const tenant = makeTenant({
      opening_hours: [{ id: '1', tenant_id: 'test-id', day_of_week: 1, is_closed: false, open_time: '18:00', close_time: '21:00' }],
    });
    const slots = getSlotsForDate(monday, tenant);
    expect(slots).toEqual(['18:00', '18:30', '19:00', '19:30', '20:00', '20:30']);
  });

  it('handles D1 integer is_closed (0 = open, 1 = closed)', () => {
    const tenant = makeTenant({
      opening_hours: [{ id: '1', tenant_id: 'test-id', day_of_week: 1, is_closed: 1, open_time: '18:00', close_time: '21:00' }],
    });
    expect(getSlotsForDate(monday, tenant)).toEqual([]);
  });

  it('falls back to defaults when open_time/close_time are null', () => {
    const tenant = makeTenant({
      opening_hours: [{ id: '1', tenant_id: 'test-id', day_of_week: 1, is_closed: false, open_time: null, close_time: null }],
    });
    const slots = getSlotsForDate(monday, tenant);
    expect(slots[0]).toBe('12:00');
  });
});

describe('getBlockTimeOptions', () => {
  // 2024-01-08 is a Monday (day_of_week 1)
  const monday: CalendarDate = { year: 2024, month: 0, day: 8 };
  const mondayHours = (open_time: string | null, close_time: string | null, is_closed = false) => [
    { id: '1', tenant_id: 'test-id', day_of_week: 1, is_closed, open_time, close_time },
  ];

  it('offers every opening slot as a start and every slot finish, including closing time, as an end', () => {
    const options = getBlockTimeOptions({ date: monday, openingHours: mondayHours('18:00', '20:00') });
    expect(options.startTimes).toEqual(['18:00', '18:30', '19:00', '19:30']);
    expect(options.endTimes).toEqual(['18:30', '19:00', '19:30', '20:00']);
  });

  it('only offers end times after the chosen start', () => {
    const options = getBlockTimeOptions({ date: monday, openingHours: mondayHours('18:00', '20:00'), startTime: '19:00' });
    expect(options.endTimes).toEqual(['19:30', '20:00']);
    expect(options.startTimes).toEqual(['18:00', '18:30', '19:00', '19:30']);
  });

  it('ends at 23:59 when the last slot runs to midnight', () => {
    const options = getBlockTimeOptions({ date: monday, openingHours: mondayHours('22:30', '23:59') });
    expect(options.startTimes).toEqual(['22:30', '23:00', '23:30']);
    expect(options.endTimes).toEqual(['23:00', '23:30', '23:59']);
  });

  it('returns no options when the day is closed', () => {
    expect(getBlockTimeOptions({ date: monday, openingHours: mondayHours(null, null, true) })).toEqual({ startTimes: [], endTimes: [] });
  });

  it('returns no options when the opening hours cross midnight', () => {
    expect(getBlockTimeOptions({ date: monday, openingHours: mondayHours('22:00', '02:00') })).toEqual({ startTimes: [], endTimes: [] });
  });

  it('falls back to the default hours when the tenant has none configured', () => {
    const options = getBlockTimeOptions({ date: monday, openingHours: null });
    expect(options.startTimes[0]).toBe('12:00');
    expect(options.endTimes[options.endTimes.length - 1]).toBe('22:00');
  });
});

describe('getEarliestTodaySlot', () => {
  afterEach(() => vi.useRealTimers());

  it('returns a slot at least 30 min ahead rounded to next 30-min boundary', () => {
    vi.setSystemTime(new Date('2024-01-08T18:00:00'));
    expect(getEarliestTodaySlot()).toBe('18:30');
  });

  it('rounds up correctly from mid-slot (18:20 → 19:00)', () => {
    vi.setSystemTime(new Date('2024-01-08T18:20:00'));
    expect(getEarliestTodaySlot()).toBe('19:00');
  });

  it('applies a custom lead time (90 min from 18:00 → 19:30)', () => {
    vi.setSystemTime(new Date('2024-01-08T18:00:00'));
    expect(getEarliestTodaySlot(90)).toBe('19:30');
  });
});

describe('getAvailableSlots', () => {
  const monday: CalendarDate = { year: 2024, month: 0, day: 8 };

  afterEach(() => vi.useRealTimers());

  it('excludes blocked times', () => {
    const tenant = makeTenant({
      opening_hours: [{ id: '1', tenant_id: 'test-id', day_of_week: 1, is_closed: false, open_time: '18:00', close_time: '19:00' }],
    });
    const slots = getAvailableSlots(monday, tenant, ['18:00']);
    expect(slots).toEqual(['18:30']);
  });

  it('filters out today slots within the booking delay window', () => {
    // "Today" is 2024-01-08 at 18:00; delay of 90 min blocks anything before 19:30.
    vi.setSystemTime(new Date('2024-01-08T18:00:00'));
    const tenant = makeTenant({
      booking_delay_minutes: 90,
      opening_hours: [{ id: '1', tenant_id: 'test-id', day_of_week: 1, is_closed: false, open_time: '18:00', close_time: '21:00' }],
    });
    const slots = getAvailableSlots(monday, tenant, []);
    expect(slots).toEqual(['19:30', '20:00', '20:30']);
  });

  it('does not apply the booking delay to future dates', () => {
    vi.setSystemTime(new Date('2024-01-08T18:00:00'));
    const tuesday: CalendarDate = { year: 2024, month: 0, day: 9 };
    const tenant = makeTenant({
      booking_delay_minutes: 180,
      opening_hours: [{ id: '1', tenant_id: 'test-id', day_of_week: 2, is_closed: false, open_time: '18:00', close_time: '19:00' }],
    });
    const slots = getAvailableSlots(tuesday, tenant, []);
    expect(slots).toEqual(['18:00', '18:30']);
  });
});
