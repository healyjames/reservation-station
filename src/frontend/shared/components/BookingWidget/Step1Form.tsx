import type { FunctionComponent } from 'preact';
import type { CalendarDate, TenantConfig } from '@shared/types';
import { FormField, SelectedDateInfo, Select, Button, Spinner } from '@shared/components';
import { getAvailableSlots } from '@shared/utils';
import type { BookingFormData } from '@shared/types';

interface Step1FormProps {
  date: CalendarDate;
  tenantConfig: TenantConfig;
  formData: BookingFormData;
  blockedTimes: string[];
  isFetchingTimes: boolean;
  onGuestsChange: (guests: number) => void;
  onTimeChange: (time: string) => void;
  onNext: () => void;
  onChangeDate: () => void;
}

export const Step1Form: FunctionComponent<Step1FormProps> = ({
  date, tenantConfig, formData, blockedTimes, isFetchingTimes,
  onGuestsChange, onTimeChange, onNext, onChangeDate
}) => {
  const maxGuests = tenantConfig.max_guests ?? 20;
  const guestOptions = Array.from({ length: maxGuests - 1 }, (_, i) => ({
    value: i + 2,
    label: `${i + 2}`,
  }));

  const availableSlots = getAvailableSlots(date, tenantConfig, blockedTimes);
  const timeOptions = availableSlots.map(slot => ({ value: slot, label: slot }));
  const isValid = formData.guests >= 2 && formData.guests <= maxGuests && formData.time !== '';

  return (
    <div class="booking-form-content">
			<div class="calendar-nav">
				<div class="step-indicator">Step 1 of 2</div>
				<button
						type="button"
						class="calendar-close-btn"
						aria-label="Close booking form"
						onClick={onChangeDate}
					>&#10006;</button>
			</div>

      <SelectedDateInfo date={date} onChangeDate={onChangeDate} />

      <form id="booking-form-step1" class="stack">
        <FormField label="Number of Guests" htmlFor="guests" required>
          <Select
            id="guests"
            name="guests"
            value={formData.guests}
            options={guestOptions}
            required
            onChange={(e) => onGuestsChange(parseInt((e.target as HTMLSelectElement).value) || 2)}
          />
        </FormField>

        <FormField label="Time" htmlFor="time" required>
          {isFetchingTimes ? (
            <div class="loading-indicator compact-loading">
              <Spinner size="sm" label="Loading available times" />
              <span>Loading times...</span>
            </div>
          ) : availableSlots.length > 0 ? (
            <Select
              id="time"
              name="time"
              value={formData.time}
              options={timeOptions}
              placeholder="Select a time"
              required
              onChange={(e) => onTimeChange((e.target as HTMLSelectElement).value)}
            />
          ) : (
            <p class="inline-helper inline-helper-error no-availability">
              No times available for this date with {formData.guests} guests. Try a different date or fewer guests.
            </p>
          )}
        </FormField>

        <Button
          variant="primary"
          fullWidth
          disabled={!isValid}
          onClick={onNext}
        >
          Next &rarr;
        </Button>
      </form>
    </div>
  );
};
