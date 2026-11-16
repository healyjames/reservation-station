import { useSignal } from '@preact/signals';
import type { ComponentChildren, FunctionComponent } from 'preact';
import type { BookingFormData, CalendarDate, TenantConfig } from '@shared/types';
import { SelectedDateInfo } from '@shared/components';
import { Alert, Button, Fieldset, Loading, Select } from '@shared/components/ui';
import { ArrowRight, X } from '@shared/components/ui/icons';
import { getAvailableSlots, isStandaloneMode } from '@shared/utils';
import { cx } from '@shared/utils/cx';

const LARGE_PARTY_SENTINEL = 'large';

type Step1FormProps = {
  date: CalendarDate;
  tenantConfig: TenantConfig;
  formData: BookingFormData;
  blockedTimes: string[];
  /** The date's bookable start times from the server; omit to use the weekly opening hours. */
  daySlots?: string[] | null;
  isFetchingTimes: boolean;
  onGuestsChange: (guests: number) => void;
  onTimeChange: (time: string) => void;
  onNext: () => void;
  onChangeDate: () => void;
};

/** A field's caption over a message, for when there is no control to label (loading, or nothing to choose). */
const FieldMessage: FunctionComponent<{ caption: string; children: ComponentChildren }> = ({ caption, children }) => (
  // Spacing matches ui/Fieldset, so nothing shifts when a message turns into a control.
  <div class="grid gap-1.5 py-1 text-sm">
    <p class="mt-0 -mb-1 py-2 font-semibold">
      {caption}
      <span aria-hidden="true"> *</span>
    </p>
    {children}
  </div>
);

const NO_AVAILABILITY = 'No availability remaining for this date. Please select a different date or call us to arrange your booking.';

export const Step1Form: FunctionComponent<Step1FormProps> = ({
  date,
  tenantConfig,
  formData,
  blockedTimes,
  daySlots = null,
  isFetchingTimes,
  onGuestsChange,
  onTimeChange,
  onNext,
  onChangeDate,
}) => {
  const displayGuestValue = useSignal<number | string>(formData.guests);

  const isUnlimited = tenantConfig.max_guests === 0;
  const bookingPartyLimit = tenantConfig.max_guests > 0 ? tenantConfig.max_guests : null;
  const venueCapacityLimit = tenantConfig.max_covers > 0 ? tenantConfig.max_covers : null;
  const effectiveMaxGuests =
    bookingPartyLimit !== null && venueCapacityLimit !== null
      ? Math.min(bookingPartyLimit, venueCapacityLimit)
      : (bookingPartyLimit ?? venueCapacityLimit ?? 20);

  const regularMax = isUnlimited ? 9 : effectiveMaxGuests;
  const callThreshold = isUnlimited ? 10 : effectiveMaxGuests + 1;
  const isLargeParty = displayGuestValue.value === LARGE_PARTY_SENTINEL;

  const guestOptions =
    effectiveMaxGuests < 2
      ? []
      : [
          ...Array.from({ length: Math.max(0, regularMax - 1) }, (_, i) => ({ value: i + 2, label: `${i + 2}` })),
          { value: LARGE_PARTY_SENTINEL, label: `${callThreshold}+` },
        ];

  function handleGuestChange(e: Event) {
    const raw = (e.target as HTMLSelectElement).value;
    if (raw === LARGE_PARTY_SENTINEL) {
      displayGuestValue.value = LARGE_PARTY_SENTINEL;
    } else {
      const val = parseInt(raw, 10) || 2;
      displayGuestValue.value = val;
      onGuestsChange(val);
    }
  }

  const availableSlots = getAvailableSlots(date, tenantConfig, blockedTimes, daySlots);
  const timeOptions = availableSlots.map((slot) => ({ value: slot, label: slot }));
  const isValid = !isLargeParty && formData.guests >= 2 && formData.guests <= effectiveMaxGuests && formData.time !== '';

  return (
    <div class={cx('p-6 motion-safe:animate-slide-in', isStandaloneMode() && 'mx-auto my-8 max-w-[520px]')}>
      <div class="mb-4 flex items-center justify-end gap-3">
        <div class="bg-base-200 text-accent rounded-field px-4 py-2 text-sm font-semibold">Step 1 of 2</div>
        <Button
          variant="ghost"
          shape="square"
          class="[--btn-bg:var(--color-base-200)] hover:[--btn-bg:var(--color-base-300)]"
          aria-label="Close booking form"
          onClick={onChangeDate}
        >
          <X />
        </Button>
      </div>

      <SelectedDateInfo date={date} />

      <form id="booking-form-step1" class="grid gap-4">
        {effectiveMaxGuests < 2 ? (
          <FieldMessage caption="Number of Guests">
            <p class="text-error m-0">{NO_AVAILABILITY}</p>
          </FieldMessage>
        ) : (
          <div class="grid gap-2">
            <Fieldset label="Number of Guests" required>
              <Select
                id="guests"
                name="guests"
                value={displayGuestValue.value}
                options={guestOptions}
                required
                onChange={handleGuestChange}
              />
            </Fieldset>
            {isLargeParty && (
              <Alert variant="warning" live="assertive">
                <p>
                  <strong>For bookings of {callThreshold} or more guests, please call the venue directly.</strong>
                </p>
              </Alert>
            )}
          </div>
        )}

        {!isLargeParty &&
          (isFetchingTimes ? (
            <FieldMessage caption="Time">
              <div class="flex items-center gap-3">
                <Loading size="sm" label="Loading available times" />
                <span aria-hidden="true">Loading times...</span>
              </div>
            </FieldMessage>
          ) : effectiveMaxGuests < 2 ? (
            <FieldMessage caption="Time">
              <p class="text-error m-0">{NO_AVAILABILITY}</p>
            </FieldMessage>
          ) : availableSlots.length > 0 ? (
            <Fieldset label="Time" required>
              <Select
                id="time"
                name="time"
                value={formData.time}
                options={timeOptions}
                placeholder="Select a time"
                required
                onChange={(e) => onTimeChange((e.target as HTMLSelectElement).value)}
              />
            </Fieldset>
          ) : (
            <FieldMessage caption="Time">
              <p class="text-error m-0">
                No times available for this date with {formData.guests} guests. Try a different date or fewer guests.
              </p>
            </FieldMessage>
          ))}

        <Button variant="primary" block disabled={!isValid} onClick={onNext}>
          Next
          <ArrowRight />
        </Button>
      </form>
    </div>
  );
};
