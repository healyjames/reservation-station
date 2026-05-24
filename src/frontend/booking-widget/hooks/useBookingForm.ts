import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { TenantConfig, CalendarDate } from '@shared/types';
import { formatDateForAPI } from '@shared/utils';
import type { BookingFormData, BookingRequest } from '../types/booking';

interface UseBookingFormReturn {
  formData: Signal<BookingFormData>;
  submitError: Signal<string>;
  isSubmitting: Signal<boolean>;
  updateField: <K extends keyof BookingFormData>(field: K, value: BookingFormData[K]) => void;
  submitBooking: (
    tenantConfig: TenantConfig,
    selectedDate: CalendarDate,
    onSuccess: () => void
  ) => Promise<void>;
  resetForm: () => void;
}

const defaultFormData = (): BookingFormData => ({
  guests: 2,
  time: '',
  firstName: '',
  surname: '',
  email: '',
  telephone: '',
  dietary: '',
});

export function useBookingForm(): UseBookingFormReturn {
  const formData = useSignal<BookingFormData>(defaultFormData());
  const submitError = useSignal('');
  const isSubmitting = useSignal(false);

  function updateField<K extends keyof BookingFormData>(field: K, value: BookingFormData[K]): void {
    formData.value = { ...formData.value, [field]: value };
  }

  async function submitBooking(
    tenantConfig: TenantConfig,
    selectedDate: CalendarDate,
    onSuccess: () => void
  ): Promise<void> {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    submitError.value = '';

    const { guests, time, firstName, surname, email, telephone, dietary } = formData.value;

    const requestBody: BookingRequest = {
      tenant_id: tenantConfig.id,
      first_name: firstName.trim(),
      surname: surname.trim(),
      telephone: telephone.trim(),
      email: email.trim(),
      reservation_date: formatDateForAPI(selectedDate),
      reservation_time: time,
      guests,
      ...(dietary.trim() ? { dietary_requirements: dietary.trim() } : {}),
    };

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        onSuccess();
        return;
      }

      const errorData = await response.json().catch(() => null) as { error?: string } | null;
      submitError.value = errorData?.error ?? 'Failed to create reservation. Please try again.';
    } catch {
      submitError.value = 'Network error. Please check your connection and try again.';
    } finally {
      isSubmitting.value = false;
    }
  }

  function resetForm(): void {
    formData.value = defaultFormData();
    submitError.value = '';
  }

  return { formData, submitError, isSubmitting, updateField, submitBooking, resetForm };
}
