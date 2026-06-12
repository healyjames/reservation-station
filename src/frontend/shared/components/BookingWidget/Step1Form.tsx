import type { FunctionComponent } from 'preact';
import type { BookingFormData, CalendarDate, TenantConfig } from '@shared/types';
import { FormField, SelectedDateInfo, Select, Button, Spinner } from '@shared/components';
import { getAvailableSlots } from '@shared/utils';
import styles from './Step1Form.module.css';

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
  date,
  tenantConfig,
  formData,
  blockedTimes,
  isFetchingTimes,
  onGuestsChange,
  onTimeChange,
  onNext,
  onChangeDate,
}) => {
  const bookingPartyLimit = tenantConfig.max_guests > 0 ? tenantConfig.max_guests : null;
  const venueCapacityLimit = tenantConfig.max_covers > 0 ? tenantConfig.max_covers : null;
  const effectiveMaxGuests = bookingPartyLimit !== null && venueCapacityLimit !== null
    ? Math.min(bookingPartyLimit, venueCapacityLimit)
    : bookingPartyLimit ?? venueCapacityLimit ?? 20;

  const guestOptions = Array.from(
    { length: Math.max(0, effectiveMaxGuests - 1) },
    (_, i) => ({ value: i + 2, label: `${i + 2}` }),
  );

  const availableSlots = getAvailableSlots(date, tenantConfig, blockedTimes);
  const timeOptions = availableSlots.map((slot) => ({ value: slot, label: slot }));
  const isValid = formData.guests >= 2 && formData.guests <= effectiveMaxGuests && formData.time !== '';

  return (
    <div class={styles.content}>
			<div class={styles.nav}>
				<div class={styles.stepIndicator}>Step 1 of 2</div>
				<button
						type="button"
						class={styles.closeBtn}
						aria-label="Close booking form"
						onClick={onChangeDate}
					>&#10006;</button>
			</div>

      <SelectedDateInfo date={date} onChangeDate={onChangeDate} />

      <form id="booking-form-step1" class={styles.form}>
        <FormField label="Number of Guests" htmlFor="guests" required>
          {effectiveMaxGuests < 2 ? (
            <p class={`${styles.inlineHelper} ${styles.inlineHelperError}`}>
              No availability remaining for this date. Please select a different date or call us to arrange your booking.
            </p>
          ) : (
            <Select
              id="guests"
              name="guests"
              value={formData.guests}
              options={guestOptions}
              required
              onChange={(e) => onGuestsChange(parseInt((e.target as HTMLSelectElement).value, 10) || 2)}
            />
          )}
        </FormField>

        <FormField label="Time" htmlFor="time" required>
          {isFetchingTimes ? (
            <div class={styles.loadingIndicator}>
              <Spinner size="sm" label="Loading available times" />
              <span>Loading times...</span>
            </div>
          ) : effectiveMaxGuests < 2 ? (
            <p class={`${styles.inlineHelper} ${styles.inlineHelperError}`}>
              No availability remaining for this date. Please select a different date or call us to arrange your booking.
            </p>
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
            <p class={`${styles.inlineHelper} ${styles.inlineHelperError}`}>
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
