import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateTimeSlots, getSlotsForDate, getEarliestTodaySlot, getAvailableSlots } from './slots';
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
});

describe('getAvailableSlots', () => {
  const monday: CalendarDate = { year: 2024, month: 0, day: 8 };

  it('excludes blocked times', () => {
    const tenant = makeTenant({
      opening_hours: [{ id: '1', tenant_id: 'test-id', day_of_week: 1, is_closed: false, open_time: '18:00', close_time: '19:00' }],
    });
    const slots = getAvailableSlots(monday, tenant, ['18:00']);
    expect(slots).toEqual(['18:30']);
  });
});
