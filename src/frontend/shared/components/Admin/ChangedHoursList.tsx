import type { FunctionComponent } from 'preact';
import { useId } from 'preact/hooks';
import type { AdminBlockedDate, AdminDateOverride } from '@shared/types';
import { Alert, Button, List } from '@shared/components/ui';
import { Trash2 } from '@shared/components/ui/icons';
import { formatDate } from '@shared/utils';
import { MONTH_NAMES } from '@constants';

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
  const headingId = useId();

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
    <section aria-labelledby={headingId} class="grid gap-3">
      <h2 id={headingId} class="m-0 text-lg font-semibold">
        {title}
      </h2>
      {errorMessage && (
        <Alert variant="error" live="assertive">
          {errorMessage}
        </Alert>
      )}
      {rows.length === 0 ? (
        <p class="text-base-content/70 m-0 text-sm">No days have changed hours this month.</p>
      ) : (
        <List
          class="rounded-box bg-base-200"
          aria-label={title}
          rows={rows.map((row) => ({
            key: row.key,
            content: (
              <>
                <span class="font-medium">{formatDate(row.date)}</span>
                <span class="text-base-content/70">{row.kind}</span>
                {row.times && <span class="tabular-nums">{row.times}</span>}
                {row.reason && <span class="text-base-content/70">{row.reason}</span>}
              </>
            ),
            action: (
              <Button variant="ghost" size="sm" class="text-error" disabled={isSaving} aria-label={row.removeLabel} onClick={row.onRemove}>
                <Trash2 />
                Remove
              </Button>
            ),
          }))}
        />
      )}
    </section>
  );
};

export default ChangedHoursList;
