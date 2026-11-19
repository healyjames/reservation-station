import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { AdminBlockedDate, AdminDateOverride, CalendarDate, OpeningHoursEntry, TimeBlockInput } from '@shared/types';
import { Alert, Button, Card, Fieldset, Input, List, Select } from '@shared/components/ui';
import { Trash2 } from '@shared/components/ui/icons';
import { getBlockTimeOptions } from '@shared/utils';

const MAX_REASON_LENGTH = 200;

type DayTimeBlocksProps = {
  date: CalendarDate;
  /** The venue's weekly schedule: `null` when none is configured, `undefined` while it has not been loaded. */
  openingHours: OpeningHoursEntry[] | null | undefined;
  /** Special hours set for this date, which replace the weekly opening hours. */
  specialHours?: AdminDateOverride | null;
  /** The day's time-range blocks, in display order. */
  blocks: AdminBlockedDate[];
  isLoading: boolean;
  errorMessage: string;
  /** Resolves true when the block was created, which resets the form. */
  onAdd: (input: TimeBlockInput) => Promise<boolean>;
  onRemove: (id: string) => void;
};

const DayTimeBlocks: FunctionComponent<DayTimeBlocksProps> = ({
  date,
  openingHours,
  specialHours = null,
  blocks,
  isLoading,
  errorMessage,
  onAdd,
  onRemove,
}) => {
  const startTime = useSignal('');
  const endTime = useSignal('');
  const reason = useSignal('');

  const hoursLoaded = openingHours !== undefined;
  const hours = openingHours ?? null;
  const { startTimes, endTimes: allEndTimes } = getBlockTimeOptions({ date, openingHours: hours, specialHours });
  const { endTimes } = getBlockTimeOptions({ date, openingHours: hours, specialHours, startTime: startTime.value || undefined });
  const closingTime = allEndTimes[allEndTimes.length - 1];
  const canBlock = hoursLoaded && startTimes.length > 0;
  const isValid = startTime.value !== '' && endTime.value > startTime.value;

  function handleStartChange(e: Event) {
    startTime.value = (e.target as HTMLSelectElement).value;
    if (endTime.value <= startTime.value) endTime.value = '';
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!isValid || isLoading) return;

    const added = await onAdd({ start_time: startTime.value, end_time: endTime.value, reason: reason.value });
    if (!added) return;

    startTime.value = '';
    endTime.value = '';
    reason.value = '';
  }

  return (
    <Card
      as="section"
      aria-labelledby="day-time-blocks-heading"
      class="bg-base-200 [--card-p:1rem] [--cardtitle-fs:0.9375rem]"
      title={<span id="day-time-blocks-heading">Block a time range</span>}
      titleAs="h4"
    >
      <p class="text-base-content/70 text-sm">
        Customers will not be able to book a table starting in this range. The end time itself stays bookable. Existing reservations will
        not be affected.
      </p>

      {canBlock ? (
        <form
          class="grid grid-cols-2 items-end gap-3 md:grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(10rem,2fr)_auto]"
          onSubmit={handleSubmit}
        >
          <Fieldset label="From" htmlFor="block-start">
            <Select
              id="block-start"
              name="block-start"
              value={startTime.value}
              options={startTimes.map((time) => ({ value: time, label: time }))}
              placeholder="Start"
              onChange={handleStartChange}
            />
          </Fieldset>
          <Fieldset label="Until" htmlFor="block-end">
            <Select
              id="block-end"
              name="block-end"
              value={endTime.value}
              options={endTimes.map((time) => ({ value: time, label: time === closingTime ? `${time} (close)` : time }))}
              placeholder="End"
              disabled={startTime.value === ''}
              onChange={(e) => {
                endTime.value = (e.target as HTMLSelectElement).value;
              }}
            />
          </Fieldset>
          <Fieldset label="Reason (optional)" htmlFor="block-reason" class="col-span-2 md:col-span-1">
            <Input
              id="block-reason"
              name="block-reason"
              value={reason.value}
              maxLength={MAX_REASON_LENGTH}
              placeholder="e.g. Private party"
              onInput={(e) => {
                reason.value = (e.target as HTMLInputElement).value;
              }}
            />
          </Fieldset>
          <Button type="submit" variant="primary" disabled={!isValid} isLoading={isLoading} class="col-span-2 mb-1 md:col-span-1">
            Block time range
          </Button>
        </form>
      ) : (
        <p class="text-base-content/70 text-sm">
          {hoursLoaded
            ? 'Time ranges can only be blocked on days the venue is open, with opening hours that end before midnight. This day is closed or its hours run past midnight. Set special opening hours for this day to open it.'
            : 'Opening hours are not loaded yet. Use Refresh if this message does not go away.'}
        </p>
      )}

      {errorMessage && (
        <Alert variant="error" live="assertive">
          {errorMessage}
        </Alert>
      )}

      {blocks.length === 0 ? (
        <p class="text-base-content/70 text-sm">No time ranges are blocked on this day.</p>
      ) : (
        <List
          class="rounded-box bg-base-100"
          aria-label="Blocked time ranges"
          rows={blocks.map((block) => ({
            key: block.id,
            content: (
              <>
                <span class="font-medium tabular-nums">
                  {block.start_time} – {block.end_time}
                </span>
                {block.reason && <span class="text-base-content/70">{block.reason}</span>}
              </>
            ),
            action: (
              <Button
                variant="ghost"
                size="sm"
                class="text-error"
                disabled={isLoading}
                aria-label={`Remove block ${block.start_time} to ${block.end_time}`}
                onClick={() => onRemove(block.id)}
              >
                <Trash2 />
                Remove
              </Button>
            ),
          }))}
        />
      )}
    </Card>
  );
};

export default DayTimeBlocks;
