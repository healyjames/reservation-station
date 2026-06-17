// @vitest-environment jsdom
import { render, within } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import { Step1Form } from './Step1Form';
import type { BookingFormData, CalendarDate, TenantConfig } from '@shared/types';

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

function renderStep1Form({
  tenantOverrides = {},
  formData = makeFormData(),
  blockedTimes = [],
}: {
  tenantOverrides?: Partial<TenantConfig>;
  formData?: BookingFormData;
  blockedTimes?: string[];
} = {}) {
  return render(
    <Step1Form
      date={testDate}
      tenantConfig={makeTenant(tenantOverrides)}
      formData={formData}
      blockedTimes={blockedTimes}
      isFetchingTimes={false}
      onGuestsChange={vi.fn()}
      onTimeChange={vi.fn()}
      onNext={vi.fn()}
      onChangeDate={vi.fn()}
    />,
  );
}

describe('Step1Form', () => {
  it('caps guest options at max_guests when max_guests is set', () => {
    const { getByLabelText } = renderStep1Form({
      tenantOverrides: { max_guests: 4, max_covers: 20 },
      formData: makeFormData({ guests: 4 }),
    });

    const guestSelect = getByLabelText(/number of guests/i) as HTMLSelectElement;
    const optionLabels = within(guestSelect).getAllByRole('option').map((o) => o.textContent);

    expect(optionLabels).toEqual(['2', '3', '4']);
  });

  it('caps guest options at max_covers when max_guests is 0 (unlimited party size)', () => {
    const { getByLabelText } = renderStep1Form({
      tenantOverrides: { max_guests: 0, max_covers: 4 },
      formData: makeFormData({ guests: 4 }),
    });

    const guestSelect = getByLabelText(/number of guests/i) as HTMLSelectElement;
    const optionLabels = within(guestSelect).getAllByRole('option').map((o) => o.textContent);

    expect(optionLabels).toEqual(['2', '3', '4']);
  });

  it('does not show the no availability message based on removed daily capacity rules', () => {
    const { queryByText } = renderStep1Form({
      tenantOverrides: { max_guests: 8, max_covers: 40 },
    });

    expect(queryByText(/no availability remaining for this date/i)).toBeNull();
  });

  it('shows an inline unavailable message when blocked times cover all slots', () => {
    const { getByText } = renderStep1Form({
      formData: makeFormData({ guests: 4, time: '' }),
      blockedTimes: ['18:00', '18:30', '19:00', '19:30'],
    });

    expect(getByText(/no times available for this date with 4 guests/i)).toBeTruthy();
  });
});
