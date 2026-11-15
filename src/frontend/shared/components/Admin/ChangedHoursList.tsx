import type { FunctionComponent } from 'preact';
import type { AdminBlockedDate } from '@shared/types';
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
  isSaving: boolean;
  errorMessage?: string;
  onRemove: (id: string) => void;
};

/** "Changed hours in <month>": every time-range block in a month, each with Remove. */
const ChangedHoursList: FunctionComponent<ChangedHoursListProps> = ({ year, month, blocks, isSaving, errorMessage, onRemove }) => {
  const title = `Changed hours in ${MONTH_NAMES[month]} ${year}`;

  return (
    <section aria-label={title}>
      <h4 class={styles.title}>{title}</h4>
      {errorMessage && (
        <p class={styles.error} role="alert">
          {errorMessage}
        </p>
      )}
      {blocks.length === 0 ? (
        <p class={styles.empty}>No days have changed hours this month.</p>
      ) : (
        <ul class={styles.list} aria-label={title}>
          {blocks.map((block) => (
            <li key={block.id} class={styles.list_item}>
              <span>{formatDate(block.date)}</span>
              <span class={styles.list_range}>
                {block.start_time} – {block.end_time}
              </span>
              {block.reason && <span class={styles.list_reason}>{block.reason}</span>}
              <Button
                variant="action-delete"
                size="sm"
                disabled={isSaving}
                aria-label={`Remove ${block.start_time} to ${block.end_time} on ${formatDate(block.date)}`}
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

export default ChangedHoursList;
