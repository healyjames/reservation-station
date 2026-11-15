import type { FunctionComponent } from 'preact';
import type { AdminBlockedDate, AdminDateOverride } from '@shared/types';
import { Button } from '@shared/components';
import { formatDate } from '@shared/utils';
import { MONTH_NAMES } from '@constants';
import styles from './ChangedHoursList.module.css';

type ChangedHoursListProps = {
  year: number;
  /** 0-indexed: 0 = January */
  month: number;
  /** The month's time-range blocks, in display order. */
  blocks: AdminBlockedDate[];
  /** The month's special opening hours. */
  overrides?: AdminDateOverride[];
  isSaving: boolean;
  errorMessage?: string;
  onRemove: (id: string) => void;
  /** Removes a date's special hours. `date` is YYYY-MM-DD. */
  onRemoveOverride?: (date: string) => void;
};

type ChangedHoursRow = {
  key: string;
  date: string;
  /** Sorts special hours ahead of the blocked ranges on the same date. */
  order: string;
  kind: string;
  times: string;
  reason?: string | null;
  removeLabel: string;
  onRemove: () => void;
};

/** "Changed hours in <month>": every special-hours date and blocked time range in a month, each with Remove. */
const ChangedHoursList: FunctionComponent<ChangedHoursListProps> = ({
  year,
  month,
  blocks,
  overrides = [],
  isSaving,
  errorMessage,
  onRemove,
  onRemoveOverride,
}) => {
  const title = `Changed hours in ${MONTH_NAMES[month]} ${year}`;

  const rows: ChangedHoursRow[] = [
    ...overrides.map((override) => ({
      key: `override-${override.id}`,
      date: override.date,
      order: '0',
      kind: override.is_closed ? 'Closed' : 'Special hours',
      times: override.is_closed ? '' : `${override.open_time} – ${override.close_time}`,
      reason: override.reason,
      removeLabel: `Remove special hours on ${formatDate(override.date)}`,
      onRemove: () => onRemoveOverride?.(override.date),
    })),
    ...blocks.map((block) => ({
      key: `block-${block.id}`,
      date: block.date,
      order: `1-${block.start_time}`,
      kind: 'Blocked',
      times: `${block.start_time} – ${block.end_time}`,
      reason: block.reason,
      removeLabel: `Remove ${block.start_time} to ${block.end_time} on ${formatDate(block.date)}`,
      onRemove: () => onRemove(block.id),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));

  return (
    <section aria-label={title}>
      <h4 class={styles.title}>{title}</h4>
      {errorMessage && (
        <p class={styles.error} role="alert">
          {errorMessage}
        </p>
      )}
      {rows.length === 0 ? (
        <p class={styles.empty}>No days have changed hours this month.</p>
      ) : (
        <ul class={styles.list} aria-label={title}>
          {rows.map((row) => (
            <li key={row.key} class={styles.list_item}>
              <span>{formatDate(row.date)}</span>
              <span class={styles.list_kind}>{row.kind}</span>
              {row.times && <span class={styles.list_range}>{row.times}</span>}
              {row.reason && <span class={styles.list_reason}>{row.reason}</span>}
              <Button variant="action-delete" size="sm" disabled={isSaving} aria-label={row.removeLabel} onClick={row.onRemove}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ChangedHoursList;
