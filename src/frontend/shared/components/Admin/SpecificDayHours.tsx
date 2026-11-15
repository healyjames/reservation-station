import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { AdminBlockedDate, CalendarDate, TimeBlockInput } from '@shared/types';
import { Button } from '@shared/components';
import { Calendar } from '@shared/components/BookingWidget/Calendar';
import { useOpeningHours } from '@shared/hooks/useOpeningHours';
import { adminFetch } from '@shared/utils/adminFetch';
import { formatDate, formatDateForAPI, formatDateForDisplay, getBlockTimeOptions, padTwo } from '@shared/utils';
import { MONTH_NAMES } from '@constants';
import DayTimeBlocks from './DayTimeBlocks';
import styles from './SpecificDayHours.module.css';

const SAVE_ERROR = 'Could not update the hours for this day. Please try again.';

type SpecificDayHoursProps = {
  token: string;
  onBack: () => void;
};

/** Settings view for changing the bookable hours of one specific date by blocking time ranges on it. */
const SpecificDayHours: FunctionComponent<SpecificDayHoursProps> = ({ token, onBack }) => {
  const today = new Date();
  const viewYear = useSignal(today.getFullYear());
  const viewMonth = useSignal(today.getMonth());
  const selectedDate = useSignal<CalendarDate | null>(null);
  const monthRows = useSignal<AdminBlockedDate[]>([]);
  const isFetching = useSignal(false);
  const isSaving = useSignal(false);
  const loadError = useSignal('');
  const saveError = useSignal('');
  const { openingHours } = useOpeningHours(() => token);

  async function loadMonth(year: number, month: number): Promise<void> {
    viewYear.value = year;
    viewMonth.value = month;
    selectedDate.value = null;
    saveError.value = '';
    loadError.value = '';
    isFetching.value = true;
    try {
      const res = await adminFetch(`/api/admin/blocked-dates?month=${year}-${padTwo(month + 1)}`, token);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as AdminBlockedDate[];
      // A slower response for a month the admin has already left must not replace the visible one.
      if (viewYear.value === year && viewMonth.value === month) monthRows.value = rows;
    } catch {
      loadError.value = 'Could not load this month. Please try again.';
    } finally {
      isFetching.value = false;
    }
  }

  async function save(request: () => Promise<boolean>): Promise<boolean> {
    isSaving.value = true;
    saveError.value = '';
    try {
      const saved = await request();
      if (!saved) saveError.value = SAVE_ERROR;
      return saved;
    } catch {
      saveError.value = SAVE_ERROR;
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  async function addBlock({ start_time, end_time, reason }: TimeBlockInput): Promise<boolean> {
    const date = selectedDate.value;
    if (!date) return false;

    const trimmedReason = reason?.trim();
    return save(async () => {
      const res = await adminFetch('/api/admin/blocked-dates', token, {
        method: 'POST',
        body: JSON.stringify({ date: formatDateForAPI(date), start_time, end_time, ...(trimmedReason ? { reason: trimmedReason } : {}) }),
      });
      if (!res.ok) return false;

      const created = (await res.json()) as AdminBlockedDate;
      monthRows.value = [...monthRows.value, created];
      return true;
    });
  }

  async function removeBlock(id: string): Promise<void> {
    await save(async () => {
      const res = await adminFetch(`/api/admin/blocked-dates/${id}`, token, { method: 'DELETE' });
      // 404 means the block is already gone (removed elsewhere), which is the outcome the admin wanted.
      if (!res.ok && res.status !== 404) return false;

      monthRows.value = monthRows.value.filter((row) => row.id !== id);
      return true;
    });
  }

  const hours = openingHours.value;
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
  // Days with no bookable hours (closed, or hours running past midnight) cannot have a range added.
  const closedDates = new Set(
    hours === undefined
      ? []
      : Array.from({ length: daysInMonth }, (_, i) => ({ year: viewYear.value, month: viewMonth.value, day: i + 1 }))
          .filter((date) => getBlockTimeOptions({ date, openingHours: hours }).startTimes.length === 0)
          .map(formatDateForAPI),
  );

  const monthBlocks = monthRows.value
    .filter((row) => row.start_time !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  const selectedKey = selectedDate.value ? formatDateForAPI(selectedDate.value) : null;
  const selectedDayBlocks = monthBlocks.filter((row) => row.date === selectedKey);
  const monthLabel = `${MONTH_NAMES[viewMonth.value]} ${viewYear.value}`;

  return (
    <div class={styles.view}>
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          &#8592; Back to opening hours
        </Button>
      </div>

      <div>
        <h3 class={styles.title}>Change hours on a specific day</h3>
        <p class={styles.intro}>
          Pick a day, then block the times you do not want to take bookings for. Your normal weekly opening hours stay as they are.
        </p>
      </div>

      <div class={styles.calendar}>
        <Calendar
          year={viewYear.value}
          month={viewMonth.value}
          selectedDate={selectedDate.value}
          blockedDates={new Set()}
          closedDates={closedDates}
          blockedDatesError={loadError.value}
          isFetchingDates={isFetching.value}
          onMonthChange={loadMonth}
          onDateSelect={async (year, month, day) => {
            selectedDate.value = { year, month, day };
            saveError.value = '';
          }}
        />
      </div>

      {selectedDate.value ? (
        <div class={styles.day}>
          <h4 class={styles.day_title}>{formatDateForDisplay(selectedDate.value)}</h4>
          <DayTimeBlocks
            key={selectedKey ?? ''}
            date={selectedDate.value}
            openingHours={hours}
            blocks={selectedDayBlocks}
            isLoading={isSaving.value}
            errorMessage={saveError.value}
            onAdd={addBlock}
            onRemove={(id) => void removeBlock(id)}
          />
        </div>
      ) : (
        <p class={styles.hint}>Select a day on the calendar to change its hours.</p>
      )}

      <section aria-labelledby="month-changes-heading">
        <h4 class={styles.day_title} id="month-changes-heading">
          Changed hours in {monthLabel}
        </h4>
        {!selectedDate.value && saveError.value && (
          <p class={styles.error} role="alert">
            {saveError.value}
          </p>
        )}
        {monthBlocks.length === 0 ? (
          <p class={styles.hint}>No days have changed hours this month.</p>
        ) : (
          <ul class={styles.list} aria-label={`Changed hours in ${monthLabel}`}>
            {monthBlocks.map((block) => (
              <li key={block.id} class={styles.list_item}>
                <span class={styles.list_date}>{formatDate(block.date)}</span>
                <span class={styles.list_range}>
                  {block.start_time} – {block.end_time}
                </span>
                {block.reason && <span class={styles.list_reason}>{block.reason}</span>}
                <Button
                  variant="action-delete"
                  size="sm"
                  disabled={isSaving.value}
                  aria-label={`Remove ${block.start_time} to ${block.end_time} on ${formatDate(block.date)}`}
                  onClick={() => void removeBlock(block.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default SpecificDayHours;
