import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { AdminDateOverride, SpecialHoursInput } from '@shared/types';
import { Button, Card, Fieldset, Input, Select } from '@shared/components/ui';
import { getSpecialHoursOptions } from '@shared/utils';

const MAX_REASON_LENGTH = 200;

type SpecialHoursFormProps = {
  /** The day's normal hours in words, e.g. "12:00 – 22:00" or "Closed". */
  normalHours: string;
  /** The special hours already set for this date, if any. */
  specialHours: AdminDateOverride | null;
  isLoading: boolean;
  /** Resolves true when the hours were saved. */
  onSave: (input: SpecialHoursInput) => Promise<boolean>;
  onRemove: () => void;
};

/** Sets opening hours for one date that replace its normal weekly hours, including opening a normally closed day. */
const SpecialHoursForm: FunctionComponent<SpecialHoursFormProps> = ({ normalHours, specialHours, isLoading, onSave, onRemove }) => {
  const openTime = useSignal(specialHours?.open_time ?? '');
  const closeTime = useSignal(specialHours?.close_time ?? '');
  const reason = useSignal(specialHours?.reason ?? '');

  const { openTimes } = getSpecialHoursOptions();
  const { closeTimes } = getSpecialHoursOptions(openTime.value || undefined);
  const isValid = openTime.value !== '' && closeTime.value > openTime.value;
  const hasSpecialHours = specialHours !== null;

  function handleOpenChange(e: Event) {
    openTime.value = (e.target as HTMLSelectElement).value;
    if (closeTime.value <= openTime.value) closeTime.value = '';
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!isValid || isLoading) return;
    await onSave({ open_time: openTime.value, close_time: closeTime.value, reason: reason.value });
  }

  return (
    <Card
      as="section"
      aria-labelledby="special-hours-heading"
      class="bg-base-200 [--card-p:1rem] [--cardtitle-fs:0.9375rem]"
      title={<span id="special-hours-heading">Opening hours on this day</span>}
      titleAs="h4"
    >
      <p class="text-base-content/70 text-sm">
        Normal hours: {normalHours}.{' '}
        {hasSpecialHours
          ? specialHours.is_closed
            ? 'This day is set to closed.'
            : `Special hours are set: ${specialHours.open_time} – ${specialHours.close_time}.`
          : 'Set special hours to open at different times, or to open on a day you are normally closed.'}{' '}
        Existing reservations will not be affected.
      </p>

      <form
        class="grid grid-cols-2 items-end gap-3 md:grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(10rem,2fr)_auto]"
        onSubmit={handleSubmit}
      >
        <Fieldset label="Opens" htmlFor="special-open">
          <Select
            id="special-open"
            name="special-open"
            value={openTime.value}
            options={openTimes.map((time) => ({ value: time, label: time }))}
            placeholder="Opens"
            onChange={handleOpenChange}
          />
        </Fieldset>
        <Fieldset label="Closes" htmlFor="special-close">
          <Select
            id="special-close"
            name="special-close"
            value={closeTime.value}
            options={closeTimes.map((time) => ({ value: time, label: time }))}
            placeholder="Closes"
            disabled={openTime.value === ''}
            onChange={(e) => {
              closeTime.value = (e.target as HTMLSelectElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Note (optional)" htmlFor="special-reason" class="col-span-2 md:col-span-1">
          <Input
            id="special-reason"
            name="special-reason"
            value={reason.value}
            maxLength={MAX_REASON_LENGTH}
            placeholder="e.g. Boxing Day"
            onInput={(e) => {
              reason.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <div class="col-span-2 mb-1 flex flex-wrap gap-2 md:col-span-1">
          <Button type="submit" variant="primary" disabled={!isValid} isLoading={isLoading}>
            {hasSpecialHours ? 'Update special hours' : 'Set special hours'}
          </Button>
          {hasSpecialHours && (
            <Button variant="secondary" disabled={isLoading} onClick={onRemove}>
              Use normal hours
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
};

export default SpecialHoursForm;
