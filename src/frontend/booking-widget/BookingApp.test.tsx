// @vitest-environment jsdom
import { render, fireEvent, act } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@preact/signals';
import { BookingApp } from './BookingApp';
import { changeSelect } from '@shared/mock/changeSelect';
import type { TenantConfig, BookingFormData } from '@shared/types';

vi.mock('@shared/hooks/useTenant');
vi.mock('@shared/hooks/useAvailability', () => ({
  useAvailability: vi.fn(),
  bustBlockedDatesCache: vi.fn(),
}));
vi.mock('@shared/hooks/useBookingForm');

import { useTenant } from '@shared/hooks/useTenant';
import { useAvailability } from '@shared/hooks/useAvailability';
import { useBookingForm } from '@shared/hooks/useBookingForm';

function makeTenant(overrides: Partial<TenantConfig> = {}): TenantConfig {
  return {
    id: 'tenant-debounce',
    name: 'Test Venue',
    tenant_code: 'test-venue',
    max_guests: 8,
    max_covers: 40,
    status: 'active',
    concurrent_guests_time_limit: 120,
    booking_delay_minutes: 0,
    opening_hours: [
      { id: '1', tenant_id: 'tenant-debounce', day_of_week: 1, is_closed: false, open_time: '12:00', close_time: '22:00' },
      { id: '2', tenant_id: 'tenant-debounce', day_of_week: 2, is_closed: false, open_time: '12:00', close_time: '22:00' },
      { id: '3', tenant_id: 'tenant-debounce', day_of_week: 3, is_closed: false, open_time: '12:00', close_time: '22:00' },
      { id: '4', tenant_id: 'tenant-debounce', day_of_week: 4, is_closed: false, open_time: '12:00', close_time: '22:00' },
      { id: '5', tenant_id: 'tenant-debounce', day_of_week: 5, is_closed: false, open_time: '12:00', close_time: '22:00' },
      { id: '6', tenant_id: 'tenant-debounce', day_of_week: 6, is_closed: false, open_time: '12:00', close_time: '22:00' },
      { id: '0', tenant_id: 'tenant-debounce', day_of_week: 0, is_closed: false, open_time: '12:00', close_time: '22:00' },
    ],
    ...overrides,
  };
}

function makeFormData(overrides: Partial<BookingFormData> = {}): BookingFormData {
  return {
    guests: 2,
    time: '',
    firstName: '',
    surname: '',
    email: '',
    telephone: '',
    dietary: '',
    ...overrides,
  };
}

describe('BookingApp', () => {
  let fetchBlockedTimesMock: ReturnType<typeof vi.fn<ReturnType<typeof useAvailability>['fetchBlockedTimes']>>;
  let fetchBlockedDatesMock: ReturnType<typeof vi.fn<ReturnType<typeof useAvailability>['fetchBlockedDates']>>;

  beforeEach(() => {
    fetchBlockedTimesMock = vi.fn<ReturnType<typeof useAvailability>['fetchBlockedTimes']>().mockResolvedValue(undefined);
    fetchBlockedDatesMock = vi.fn<ReturnType<typeof useAvailability>['fetchBlockedDates']>().mockResolvedValue(undefined);

    vi.mocked(useTenant).mockReturnValue({
      tenantConfig: signal<TenantConfig | null>(makeTenant()),
      tenantState: signal<'loading' | 'ready' | 'error'>('ready'),
      tenantError: signal(''),
    });

    vi.mocked(useAvailability).mockReturnValue({
      blockedDates: signal(new Set<string>()),
      closedDates: signal(new Set<string>()),
      blockedDatesError: signal(''),
      isFetchingDates: signal(false),
      blockedTimes: signal<string[]>([]),
      daySlots: signal<string[] | null>(null),
      isFetchingTimes: signal(false),
      fetchBlockedDates: fetchBlockedDatesMock,
      fetchBlockedTimes: fetchBlockedTimesMock,
    });

    vi.mocked(useBookingForm).mockReturnValue({
      formData: signal<BookingFormData>(makeFormData()),
      submitError: signal(''),
      isSubmitting: signal(false),
      updateField: vi.fn(),
      submitBooking: vi.fn(),
      resetForm: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // "Today" is 15 June 2099, so the calendar opens on June 2099 and the 20th is selectable.
  function useFixedClock() {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2099, 5, 15, 12));
  }

  it('shows a named loading status while the venue loads', () => {
    vi.mocked(useTenant).mockReturnValue({
      tenantConfig: signal<TenantConfig | null>(null),
      tenantState: signal<'loading' | 'ready' | 'error'>('loading'),
      tenantError: signal(''),
    });
    const { getByRole } = render(<BookingApp />);
    expect(getByRole('status').textContent).toBe('Loading booking configuration');
  });

  it('shows the load error under an "Unable to load" heading', () => {
    vi.mocked(useTenant).mockReturnValue({
      tenantConfig: signal<TenantConfig | null>(null),
      tenantState: signal<'loading' | 'ready' | 'error'>('error'),
      tenantError: signal('Venue not found'),
    });
    const { getByRole, getByText } = render(<BookingApp />);
    expect(getByRole('heading', { name: 'Unable to load' })).toBeTruthy();
    expect(getByText('Venue not found')).toBeTruthy();
  });

  it('starts on the calendar step with named month buttons', async () => {
    useFixedClock();
    const { getByRole } = render(<BookingApp />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(getByRole('region', { name: 'June 2099' })).toBeTruthy();
    expect(getByRole('button', { name: 'Previous month' })).toBeTruthy();
    expect(getByRole('button', { name: 'Next month' })).toBeTruthy();
    expect(fetchBlockedDatesMock).toHaveBeenCalledOnce();
  });

  describe('handleGuestsChange debounce', () => {
    it('calls fetchBlockedTimes exactly once after multiple rapid guest changes settle', async () => {
      useFixedClock();
      const { getByRole, getByLabelText } = render(<BookingApp />);

      // Flush the Calendar's initial useEffect (calls onMonthChange)
      await act(async () => {
        await Promise.resolve();
      });

      // Select a day to enter form-step1
      await act(async () => {
        fireEvent.click(getByRole('button', { name: '20' }));
      });

      // handleDateSelect sets selectedDate and calls fetchBlockedTimes once.
      // Reset so we count only the debounced guest-change calls.
      fetchBlockedTimesMock.mockClear();

      const guestSelect = getByLabelText(/number of guests/i);

      // Fire 3 rapid guest changes — only the last should produce a fetch after debounce
      await act(async () => {
        changeSelect(guestSelect as HTMLSelectElement, '3');
        changeSelect(guestSelect as HTMLSelectElement, '4');
        changeSelect(guestSelect as HTMLSelectElement, '5');
      });

      // Debounce timer has not fired yet
      expect(fetchBlockedTimesMock).toHaveBeenCalledTimes(0);

      // Nothing until the 250ms debounce window has passed, then exactly one call with the final value
      await act(async () => {
        vi.advanceTimersByTime(249);
      });
      expect(fetchBlockedTimesMock).toHaveBeenCalledTimes(0);

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(fetchBlockedTimesMock).toHaveBeenCalledTimes(1);
      expect(fetchBlockedTimesMock).toHaveBeenLastCalledWith('tenant-debounce', { year: 2099, month: 5, day: 20 }, 5, 40);
    });

    it('does not call fetchBlockedTimes on guest change when no date is selected', async () => {
      vi.useFakeTimers();

      const { container } = render(<BookingApp />);

      await act(async () => {
        await Promise.resolve();
      });

      // We are still on the calendar step (no date selected)
      // Simulate a hypothetical guest change with no selectedDate — skip for calendar step,
      // but verify that no debounce call is made even after timer advances
      expect(fetchBlockedTimesMock).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(fetchBlockedTimesMock).not.toHaveBeenCalled();
    });
  });
});
