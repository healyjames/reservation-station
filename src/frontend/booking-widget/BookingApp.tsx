import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import type { BookingStep } from './types/booking';
import { useTenant } from './hooks/useTenant';
import { useAvailability } from './hooks/useAvailability';
import { useBookingForm } from './hooks/useBookingForm';
import { CalendarView } from './views/CalendarView';
import { Step1FormView } from './views/Step1FormView';
import { Step2FormView } from './views/Step2FormView';
import { SuccessView } from './views/SuccessView';
import { Spinner, MessageCard } from '@shared/components';

export const BookingApp: FunctionComponent = () => {
  const step = useSignal<BookingStep>('calendar');
  const selectedDate = useSignal<CalendarDate | null>(null);
  const currentYear = useSignal(new Date().getFullYear());
  const currentMonth = useSignal(new Date().getMonth());

  const { tenantConfig, tenantState, tenantError } = useTenant();
  const { blockedDates, blockedTimes, isFetchingTimes, fetchBlockedDates, fetchBlockedTimes } = useAvailability();
  const { formData, submitError, isSubmitting, updateField, submitBooking, resetForm } = useBookingForm();

  if (tenantState.value === 'loading') {
    return (
      <div style="display:flex;justify-content:center;padding:48px">
        <Spinner size="md" label="Loading booking configuration" />
      </div>
    );
  }

  if (tenantState.value === 'error') {
    return (
      <div class="booking-form-content">
        <MessageCard variant="error" title="Unable to load">
          <p>{tenantError.value}</p>
        </MessageCard>
      </div>
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
    await fetchBlockedTimes(tenant.id, { year, month, day }, formData.value.guests);
    step.value = 'form-step1';
  }

  async function handleGuestsChange(guests: number) {
    updateField('guests', guests);
    updateField('time', '');
    if (selectedDate.value) {
      await fetchBlockedTimes(tenant.id, selectedDate.value, guests);
    }
  }

  function handleChangeDate() {
    step.value = 'calendar';
    selectedDate.value = null;
    updateField('time', '');
  }

  async function handleNewBooking() {
    resetForm();
    step.value = 'calendar';
    selectedDate.value = null;
    await fetchBlockedDates(tenant.id, currentYear.value, currentMonth.value);
  }

  if (step.value === 'calendar') {
    return (
      <CalendarView
        year={currentYear.value}
        month={currentMonth.value}
        selectedDate={selectedDate.value}
        blockedDates={blockedDates.value}
        tenantId={tenant.id}
        onMonthChange={handleMonthChange}
        onDateSelect={handleDateSelect}
      />
    );
  }

  if (step.value === 'form-step1') {
    return (
      <Step1FormView
        date={selectedDate.value!}
        tenantConfig={tenant}
        formData={formData.value}
        blockedTimes={blockedTimes.value}
        isFetchingTimes={isFetchingTimes.value}
        onGuestsChange={handleGuestsChange}
        onTimeChange={(time) => updateField('time', time)}
        onNext={() => { step.value = 'form-step2'; }}
        onChangeDate={handleChangeDate}
      />
    );
  }

  if (step.value === 'form-step2') {
    return (
      <Step2FormView
        tenantConfig={tenant}
        formData={formData.value}
        submitError={submitError.value}
        isSubmitting={isSubmitting.value}
        onFieldChange={updateField}
        onSubmit={async (formEl) => {
          if (!formEl.checkValidity()) return;
          await submitBooking(tenant, selectedDate.value!, () => { step.value = 'success'; });
        }}
        onBack={() => { step.value = 'form-step1'; }}
      />
    );
  }

  return (
    <SuccessView
      formData={formData.value}
      selectedDate={selectedDate.value!}
      onNewBooking={handleNewBooking}
    />
  );
};
