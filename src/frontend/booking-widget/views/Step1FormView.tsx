import type { FunctionComponent } from 'preact';
import type { CalendarDate, TenantConfig } from '@shared/types';
import { SelectedDateInfo, Select, Button, Spinner } from '@shared/components';
import { getAvailableSlots } from '@shared/utils';
import type { BookingFormData } from '../types/booking';

interface Step1FormViewProps {
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

export const Step1FormView: FunctionComponent<Step1FormViewProps> = ({
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
      <div class="booking-header">
        <h2>Book Your Table</h2>
        <div class="calendar-nav">
          <div class="step-indicator">Step 1 of 2</div>
          <button type="button" class="calendar-nav-btn" disabled aria-label="Previous step">&#8592;</button>
          <button
            type="button"
            class="calendar-nav-btn"
            id="next-step-btn"
            aria-label="Next step"
            disabled={!isValid}
            onClick={onNext}
          >&#8594;</button>
        </div>
      </div>

      <SelectedDateInfo date={date} onChangeDate={onChangeDate} />

      <form id="booking-form-step1">
        <div class="form-group">
          <label for="guests">Number of Guests</label>
          <Select
            id="guests"
            name="guests"
            value={formData.guests}
            options={guestOptions}
            required
            onChange={(e) => onGuestsChange(parseInt((e.target as HTMLSelectElement).value) || 2)}
          />
        </div>

        <div class="form-group">
          <label for="time">Time</label>
          {isFetchingTimes ? (
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0">
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
            <p class="no-availability" style="color: var(--primary-lighter); margin: 0;">
              No times available for this date with {formData.guests} guests. Try a different date or fewer guests.
            </p>
          )}
        </div>

        <Button
          variant="secondary"
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
