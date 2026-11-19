import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { Alert, Button } from '@shared/components/ui';
import { ArrowLeft } from '@shared/components/ui/icons';
import { Calendar } from '@shared/components/BookingWidget/Calendar';
import { useMonthTimeBlocks } from '@shared/hooks/useMonthTimeBlocks';
import { useOpeningHours } from '@shared/hooks/useOpeningHours';
import { formatDateForAPI, formatDateForDisplay, getWeeklyHoursForDate } from '@shared/utils';
import { DEFAULT_CLOSE_TIME, DEFAULT_OPEN_TIME } from '@constants';
import ChangedHoursList from './ChangedHoursList';
import DayTimeBlocks from './DayTimeBlocks';
import SpecialHoursForm from './SpecialHoursForm';

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

  // The page title (Opening hours) comes from AdminLayout's h1.
  return (
    <div class="grid gap-5">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft />
          Back to opening hours
        </Button>
      </div>

      <div>
        <h2 class="mt-0 mb-2 text-lg font-semibold">Change hours on a specific day</h2>
        <p class="text-base-content/70 m-0 text-sm">
          Pick a day, then set special opening hours for it or block the times you do not want to take bookings for. Your normal weekly
          opening hours stay as they are.
        </p>
      </div>

      {/* The shared calendar is sized for the booking widget; keep it compact here. */}
      <div class="max-w-[30rem]">
        <Calendar
          year={viewYear.value}
          month={viewMonth.value}
          selectedDate={selected}
          blockedDates={new Set()}
          headingLevel={3}
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
        <div class="grid gap-3">
          <h3 class="m-0 text-base font-semibold">{formatDateForDisplay(selected)}</h3>
          {saveError.value && (
            <Alert variant="error" live="assertive">
              {saveError.value}
            </Alert>
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
        <p class="text-base-content/70 m-0 text-sm">Select a day on the calendar to change its hours.</p>
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
