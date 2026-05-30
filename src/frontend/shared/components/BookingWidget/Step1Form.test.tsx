// @vitest-environment jsdom
import { render, within } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import { Step1Form } from './Step1Form';
import type { BookingFormData, CalendarDate, DailyCapacityResponse, TenantConfig } from '@shared/types';

const testDate: CalendarDate = { year: 2024, month: 0, day: 8 };

function makeTenant(overrides: Partial<TenantConfig> = {}): TenantConfig {
  return {
    id: 'tenant-1',
    name: 'Test Venue',
    tenant_code: 'test-venue',
    max_guests: 8,
    max_covers: 40,
    status: 'active',
    concurrent_guests_time_limit: 120,
    opening_hours: [
      { id: '1', tenant_id: 'tenant-1', day_of_week: 1, is_closed: false, open_time: '18:00', close_time: '20:00' },
    ],
    ...overrides,
  };
}

function makeFormData(overrides: Partial<BookingFormData> = {}): BookingFormData {
  return {
    guests: 4,
    time: '18:00',
    firstName: 'Alex',
    surname: 'Guest',
    email: 'alex@example.com',
    telephone: '01234567890',
    dietary: '',
    ...overrides,
  };
}

function renderStep1Form(dailyCapacity: DailyCapacityResponse | null, formData: BookingFormData = makeFormData()) {
  return render(
    <Step1Form
      date={testDate}
      tenantConfig={makeTenant()}
      formData={formData}
      blockedTimes={[]}
      dailyCapacity={dailyCapacity}
      isFetchingTimes={false}
      onGuestsChange={vi.fn()}
      onTimeChange={vi.fn()}
      onNext={vi.fn()}
      onChangeDate={vi.fn()}
    />,
  );
}

describe('Step1Form', () => {
  it('caps guest options and shows a warning when daily capacity is the limiting factor', () => {
    const { getByLabelText, getByText } = renderStep1Form({
      max_covers: 40,
      booked_covers: 36,
      remaining_covers: 4,
    });

    const guestSelect = getByLabelText(/number of guests/i) as HTMLSelectElement;
    const optionLabels = within(guestSelect).getAllByRole('option').map((option) => option.textContent);

    expect(optionLabels).toEqual(['2', '3', '4']);
    expect(getByText(/party sizes may be limited today/i)).toBeTruthy();
  });

  it('does not show the capacity warning when daily capacity is unlimited', () => {
    const { queryByText } = renderStep1Form({
      max_covers: 0,
      booked_covers: 0,
      remaining_covers: null,
    });

    expect(queryByText(/party sizes may be limited today/i)).toBeNull();
  });

  it('shows an inline sold-out message when fewer than two covers remain', () => {
    const { getAllByText, queryByLabelText, queryByText } = renderStep1Form(
      {
        max_covers: 40,
        booked_covers: 39,
        remaining_covers: 1,
      },
      makeFormData({ guests: 2, time: '' }),
    );

    expect(queryByLabelText(/number of guests/i)).toBeNull();
    expect(getAllByText(/no availability remaining for this date/i).length).toBeGreaterThan(0);
    expect(queryByText(/party sizes may be limited today/i)).toBeNull();
  });
});
