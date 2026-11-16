// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Step2Form } from './Step2Form';
import type { BookingFormData, TenantConfig } from '@shared/types';

const tenant = {
  id: 'tenant-1',
  name: 'Test Venue',
  tenant_code: 'test-venue',
  max_guests: 8,
  max_covers: 40,
  status: 'active',
  concurrent_guests_time_limit: 120,
  booking_delay_minutes: 0,
  opening_hours: [],
} as TenantConfig;

const formData: BookingFormData = {
  guests: 2,
  time: '19:00',
  firstName: 'Alex',
  surname: 'Guest',
  email: 'alex@example.com',
  telephone: '01234567890',
  dietary: '',
};

function renderStep2(props: Partial<Parameters<typeof Step2Form>[0]> = {}) {
  const handlers = { onFieldChange: vi.fn(), onSubmit: vi.fn(), onBack: vi.fn() };
  const view = render(<Step2Form tenantConfig={tenant} formData={formData} submitError="" isSubmitting={false} {...handlers} {...props} />);
  return { ...view, ...handlers };
}

describe('Step2Form', () => {
  it('labels every field and marks the contact fields required', () => {
    const { getByLabelText } = renderStep2();
    for (const label of ['First Name', 'Surname', 'Email', 'Phone Number']) {
      expect((getByLabelText(label) as HTMLInputElement).required).toBe(true);
    }
    expect((getByLabelText(/dietary requirements/i) as HTMLTextAreaElement).required).toBe(false);
    expect((getByLabelText('Email') as HTMLInputElement).type).toBe('email');
    expect((getByLabelText('Phone Number') as HTMLInputElement).type).toBe('tel');
  });

  it('reports typed values by field', () => {
    const { getByLabelText, onFieldChange } = renderStep2();
    fireEvent.input(getByLabelText('Surname'), { target: { value: 'Smith' } });
    expect(onFieldChange).toHaveBeenCalledWith('surname', 'Smith');
  });

  it('goes back from the named previous-step button', () => {
    const { getByRole, getByText, onBack } = renderStep2();
    expect(getByText('Step 2 of 2')).toBeTruthy();
    const back = getByRole('button', { name: 'Previous step' });
    expect(back.id).toBe('prev-step-btn');
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('submits the form element', () => {
    const { getByRole, onSubmit } = renderStep2();
    fireEvent.click(getByRole('button', { name: 'Book Now' }));
    expect(onSubmit).toHaveBeenCalledWith(document.getElementById('booking-form-step2'));
  });

  it('announces a submit error', () => {
    const { getByRole } = renderStep2({ submitError: 'That time has just been taken' });
    expect(getByRole('alert').textContent).toMatch('That time has just been taken');
  });

  it('shows a busy, disabled submit while booking', () => {
    const { getByRole } = renderStep2({ isSubmitting: true });
    const submit = getByRole('button', { name: 'Booking...' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('aria-busy')).toBe('true');
  });
});
