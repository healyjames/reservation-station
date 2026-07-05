import { useSignal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import type { BookingStep } from '@shared/types';
import { useTenant } from '@shared/hooks/useTenant';
import { useAvailability, bustBlockedDatesCache, bustBlockedTimesCache } from '@shared/hooks/useAvailability';
import { useBookingForm } from '@shared/hooks/useBookingForm';
import { Calendar, Step1Form, Step2Form, Success } from '@shared/components/BookingWidget';
import { Spinner, MessageCard } from '@shared/components';

import { isStandaloneMode } from '@shared/utils/userJourney';

const loadingStyles = 'display:grid;place-items:center;padding:var(--space-12)';

export const BookingApp: FunctionComponent = () => {
  const step = useSignal<BookingStep>('calendar');
  const selectedDate = useSignal<CalendarDate | null>(null);
  const currentYear = useSignal(new Date().getFullYear());
  const currentMonth = useSignal(new Date().getMonth());
  const bookingRef = useSignal<string | undefined>(undefined);

  const { tenantConfig, tenantState, tenantError } = useTenant();
  const { blockedDates, closedDates, blockedDatesError, isFetchingDates, blockedTimes, isFetchingTimes, fetchBlockedDates, fetchBlockedTimes } =
    useAvailability();
  const { formData, submitError, isSubmitting, updateField, submitBooking, resetForm } = useBookingForm();
  const guestsDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (tenantState.value === 'loading') {
    return (
      <div style={loadingStyles}>
        <Spinner size="md" label="Loading booking configuration" />
      </div>
    );
  }

  if (tenantState.value === 'error') {
    return (
      <MessageCard variant="error" title="Unable to load">
        <p>{tenantError.value}</p>
      </MessageCard>
    );
  }

  const tenant = tenantConfig.value!;

  async function handleMonthChange(year: number, month: number) {
    currentYear.value = year;
    currentMonth.value = month;
    await fetchBlockedDates(tenant.id, year, month);
  }

  async function handleDateSelect(year: number, month: number, day: number) {
    selectedDate.value = { year, month, day };
    step.value = 'form-step1';
    await fetchBlockedTimes(tenant.id, { year, month, day }, formData.value.guests, tenant.max_covers);
  }

  function handleGuestsChange(guests: number) {
    updateField('guests', guests);
    updateField('time', '');
    if (!selectedDate.value) return;

    if (guestsDebounceTimer.current !== null) clearTimeout(guestsDebounceTimer.current);
    guestsDebounceTimer.current = setTimeout(() => {
      guestsDebounceTimer.current = null;
      void fetchBlockedTimes(tenant.id, selectedDate.value!, guests, tenant.max_covers);
    }, 250);
  }

  function handleChangeDate() {
    step.value = 'calendar';
    selectedDate.value = null;
    updateField('time', '');
  }

  async function handleNewBooking() {
    const { guests } = formData.value;
    if (selectedDate.value) {
      bustBlockedTimesCache(tenant.id, selectedDate.value);
    }
    resetForm();
    bookingRef.value = undefined;
    step.value = 'calendar';
    selectedDate.value = null;
    bustBlockedDatesCache(tenant.id, currentYear.value, currentMonth.value);
    await fetchBlockedDates(tenant.id, currentYear.value, currentMonth.value, true);
  }

  if (step.value === 'calendar') {
    return (
      <Calendar
        year={currentYear.value}
        month={currentMonth.value}
        selectedDate={selectedDate.value}
        blockedDates={blockedDates.value}
        closedDates={closedDates.value}
        blockedDatesError={blockedDatesError.value}
        isFetchingDates={isFetchingDates.value}
        onMonthChange={handleMonthChange}
        onDateSelect={handleDateSelect}
        isStandalone={isStandaloneMode()}
        tenantName={tenant.name}
      />
    );
  }

  if (step.value === 'form-step1') {
    return (
      <Step1Form
        date={selectedDate.value!}
        tenantConfig={tenant}
        formData={formData.value}
        blockedTimes={blockedTimes.value}
        isFetchingTimes={isFetchingTimes.value}
        onGuestsChange={handleGuestsChange}
        onTimeChange={(time) => updateField('time', time)}
        onNext={() => {
          step.value = 'form-step2';
        }}
        onChangeDate={handleChangeDate}
      />
    );
  }

  if (step.value === 'form-step2') {
    return (
      <Step2Form
        tenantConfig={tenant}
        formData={formData.value}
        submitError={submitError.value}
        isSubmitting={isSubmitting.value}
        onFieldChange={updateField}
        onSubmit={async (formEl) => {
          if (!formEl.checkValidity()) return;
          await submitBooking(tenant, selectedDate.value!, (ref) => {
            bookingRef.value = ref;
            step.value = 'success';
          });
        }}
        onBack={() => {
          step.value = 'form-step1';
        }}
      />
    );
  }

  return (
    <Success formData={formData.value} selectedDate={selectedDate.value!} onNewBooking={handleNewBooking} bookingRef={bookingRef.value} />
  );
};
