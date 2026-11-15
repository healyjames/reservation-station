import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { Button } from '@shared/components';
import { Calendar } from '@shared/components/BookingWidget/Calendar';
import { useMonthTimeBlocks } from '@shared/hooks/useMonthTimeBlocks';
import { useOpeningHours } from '@shared/hooks/useOpeningHours';
import { formatDateForAPI, formatDateForDisplay, getBlockTimeOptions } from '@shared/utils';
import ChangedHoursList from './ChangedHoursList';
import DayTimeBlocks from './DayTimeBlocks';
import styles from './SpecificDayHours.module.css';

type SpecificDayHoursProps = {
  token: string;
  onBack: () => void;
};

/** Settings view for changing the bookable hours of one specific date by blocking time ranges on it. */
const SpecificDayHours: FunctionComponent<SpecificDayHoursProps> = ({ token, onBack }) => {
  const selectedDate = useSignal<CalendarDate | null>(null);
  const { viewYear, viewMonth, monthBlocks, isFetching, isSaving, loadError, saveError, loadMonth, addBlock, removeBlock } =
    useMonthTimeBlocks(token);
  const { openingHours } = useOpeningHours(() => token);

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

  const selected = selectedDate.value;
  const selectedKey = selected ? formatDateForAPI(selected) : null;
  const selectedDayBlocks = monthBlocks.value.filter((row) => row.date === selectedKey);

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
          selectedDate={selected}
          blockedDates={new Set()}
          closedDates={closedDates}
          blockedDatesError={loadError.value}
          isFetchingDates={isFetching.value}
          onMonthChange={async (year, month) => {
            selectedDate.value = null;
            await loadMonth(year, month);
          }}
          onDateSelect={async (year, month, day) => {
            selectedDate.value = { year, month, day };
            saveError.value = '';
          }}
        />
      </div>

      {selected ? (
        <div class={styles.day}>
          <h4 class={styles.day_title}>{formatDateForDisplay(selected)}</h4>
          <DayTimeBlocks
            key={selectedKey ?? ''}
            date={selected}
            openingHours={hours}
            blocks={selectedDayBlocks}
            isLoading={isSaving.value}
            errorMessage={saveError.value}
            onAdd={(input) => addBlock(selected, input)}
            onRemove={(id) => void removeBlock(id)}
          />
        </div>
      ) : (
        <p class={styles.hint}>Select a day on the calendar to change its hours.</p>
      )}

      <ChangedHoursList
        year={viewYear.value}
        month={viewMonth.value}
        blocks={monthBlocks.value}
        isSaving={isSaving.value}
        errorMessage={selected ? '' : saveError.value}
        onRemove={(id) => void removeBlock(id)}
      />
    </div>
  );
};

export default SpecificDayHours;
