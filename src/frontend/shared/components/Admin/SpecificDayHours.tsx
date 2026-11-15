import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { Button } from '@shared/components';
import { Calendar } from '@shared/components/BookingWidget/Calendar';
import { useMonthTimeBlocks } from '@shared/hooks/useMonthTimeBlocks';
import { useOpeningHours } from '@shared/hooks/useOpeningHours';
import { formatDateForAPI, formatDateForDisplay, getWeeklyHoursForDate } from '@shared/utils';
import { DEFAULT_CLOSE_TIME, DEFAULT_OPEN_TIME } from '@constants';
import ChangedHoursList from './ChangedHoursList';
import DayTimeBlocks from './DayTimeBlocks';
import SpecialHoursForm from './SpecialHoursForm';
import styles from './SpecificDayHours.module.css';

type SpecificDayHoursProps = {
  token: string;
  onBack: () => void;
};

/** Settings view for changing one specific date: set special opening hours for it, or block time ranges on it. */
const SpecificDayHours: FunctionComponent<SpecificDayHoursProps> = ({ token, onBack }) => {
  const selectedDate = useSignal<CalendarDate | null>(null);
  const changedHours = useMonthTimeBlocks(token);
  const { viewYear, viewMonth, monthBlocks, monthOverrides, isFetching, isSaving, loadError, saveError } = changedHours;
  const { openingHours } = useOpeningHours(() => token);

  const hours = openingHours.value;
  const selected = selectedDate.value;
  const selectedKey = selected ? formatDateForAPI(selected) : null;
  const selectedDayBlocks = monthBlocks.value.filter((row) => row.date === selectedKey);
  const selectedOverride = monthOverrides.value.find((row) => row.date === selectedKey) ?? null;

  function describeNormalHours(date: CalendarDate): string {
    if (hours === undefined) return 'loading';
    const weekly = getWeeklyHoursForDate(date, hours);
    if (hours !== null && (!weekly || weekly.is_closed)) return 'Closed';
    return `${weekly?.open_time ?? DEFAULT_OPEN_TIME} – ${weekly?.close_time ?? DEFAULT_CLOSE_TIME}`;
  }

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
          Pick a day, then set special opening hours for it or block the times you do not want to take bookings for. Your normal weekly
          opening hours stay as they are.
        </p>
      </div>

      <div class={styles.calendar}>
        <Calendar
          year={viewYear.value}
          month={viewMonth.value}
          selectedDate={selected}
          blockedDates={new Set()}
          blockedDatesError={loadError.value}
          isFetchingDates={isFetching.value}
          onMonthChange={async (year, month) => {
            selectedDate.value = null;
            await changedHours.loadMonth(year, month);
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
          {saveError.value && (
            <p class={styles.error} role="alert">
              {saveError.value}
            </p>
          )}
          <SpecialHoursForm
            key={`hours-${selectedKey}-${selectedOverride?.open_time ?? ''}-${selectedOverride?.close_time ?? ''}`}
            normalHours={describeNormalHours(selected)}
            specialHours={selectedOverride}
            isLoading={isSaving.value}
            onSave={(input) => changedHours.setSpecialHours(selected, input)}
            onRemove={() => void changedHours.removeSpecialHours(formatDateForAPI(selected))}
          />
          <DayTimeBlocks
            key={`blocks-${selectedKey}`}
            date={selected}
            openingHours={hours}
            specialHours={selectedOverride}
            blocks={selectedDayBlocks}
            isLoading={isSaving.value}
            errorMessage=""
            onAdd={(input) => changedHours.addBlock(selected, input)}
            onRemove={(id) => void changedHours.removeBlock(id)}
          />
        </div>
      ) : (
        <p class={styles.hint}>Select a day on the calendar to change its hours.</p>
      )}

      <ChangedHoursList
        year={viewYear.value}
        month={viewMonth.value}
        blocks={monthBlocks.value}
        overrides={monthOverrides.value}
        isSaving={isSaving.value}
        errorMessage={selected ? '' : saveError.value}
        onRemove={(id) => void changedHours.removeBlock(id)}
        onRemoveOverride={(date) => void changedHours.removeSpecialHours(date)}
      />
    </div>
  );
};

export default SpecificDayHours;
