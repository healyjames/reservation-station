import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { AdminBlockedDate, CalendarDate, OpeningHoursEntry, TimeBlockInput } from '@shared/types';
import { Button, FormField, Input, Select } from '@shared/components';
import { getBlockTimeOptions } from '@shared/utils';
import styles from './DayTimeBlocks.module.css';

const MAX_REASON_LENGTH = 200;

type DayTimeBlocksProps = {
  date: CalendarDate;
  /** The venue's weekly schedule: `null` when none is configured, `undefined` while it has not been loaded. */
  openingHours: OpeningHoursEntry[] | null | undefined;
  /** The day's time-range blocks, in display order. */
  blocks: AdminBlockedDate[];
  isLoading: boolean;
  errorMessage: string;
  /** Resolves true when the block was created, which resets the form. */
  onAdd: (input: TimeBlockInput) => Promise<boolean>;
  onRemove: (id: string) => void;
};

const DayTimeBlocks: FunctionComponent<DayTimeBlocksProps> = ({ date, openingHours, blocks, isLoading, errorMessage, onAdd, onRemove }) => {
  const startTime = useSignal('');
  const endTime = useSignal('');
  const reason = useSignal('');

  const hoursLoaded = openingHours !== undefined;
  const hours = openingHours ?? null;
  const { startTimes, endTimes: allEndTimes } = getBlockTimeOptions({ date, openingHours: hours });
  const { endTimes } = getBlockTimeOptions({ date, openingHours: hours, startTime: startTime.value || undefined });
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
    <section class={styles.card} aria-labelledby="day-time-blocks-heading">
      <div class={styles.intro}>
        <p class={styles.heading} id="day-time-blocks-heading">
          <strong>Block a time range</strong>
        </p>
        <p class={styles.subtext}>
          Customers will not be able to book a table starting in this range. The end time itself stays bookable. Existing reservations will
          not be affected.
        </p>
      </div>

      {canBlock ? (
        <form class={styles.form} onSubmit={handleSubmit}>
          <FormField label="From" htmlFor="block-start">
            <Select
              id="block-start"
              name="block-start"
              value={startTime.value}
              options={startTimes.map((time) => ({ value: time, label: time }))}
              placeholder="Start"
              onChange={handleStartChange}
            />
          </FormField>
          <FormField label="Until" htmlFor="block-end">
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
          </FormField>
          <FormField label="Reason (optional)" htmlFor="block-reason" class={styles.reason}>
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
          </FormField>
          <Button type="submit" variant="primary" disabled={!isValid} isLoading={isLoading} class={styles.submit}>
            Block time range
          </Button>
        </form>
      ) : (
        <p class={styles.unavailable}>
          {hoursLoaded
            ? 'Time ranges can only be blocked on days the venue is open, with opening hours that end before midnight. This day is closed or its hours run past midnight.'
            : 'Opening hours are not loaded yet. Use Refresh if this message does not go away.'}
        </p>
      )}

      {errorMessage && (
        <p class={styles.error} role="alert">
          {errorMessage}
        </p>
      )}

      {blocks.length === 0 ? (
        <p class={styles.empty}>No time ranges are blocked on this day.</p>
      ) : (
        <ul class={styles.list} aria-label="Blocked time ranges">
          {blocks.map((block) => (
            <li key={block.id} class={styles.list_item}>
              <span class={styles.range}>
                {block.start_time} – {block.end_time}
              </span>
              {block.reason && <span class={styles.block_reason}>{block.reason}</span>}
              <Button
                variant="action-delete"
                size="sm"
                disabled={isLoading}
                aria-label={`Remove block ${block.start_time} to ${block.end_time}`}
                onClick={() => onRemove(block.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default DayTimeBlocks;
