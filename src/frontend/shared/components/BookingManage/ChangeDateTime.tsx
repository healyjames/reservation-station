import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { TenantConfig, CalendarDate } from '@shared/types';
import { MONTH_NAMES } from '@constants';
import { StandaloneLayout, SelectedDateInfo } from '@shared/components';
import { Button, Calendar, Fieldset, FieldsetMessage, FloatingTooltip, Join, Loading, Select } from '@shared/components/ui';
import { ArrowLeft, ChevronLeft, ChevronRight } from '@shared/components/ui/icons';
import { getAvailableSlots } from '@shared/utils';
import { ErrorAlert } from './ErrorAlert';

const BLOCKED_MESSAGE = 'Bookings currently unavailable for this date';
const BLOCKED_TIP_MS = 3000;

type ChangeDateTimeProps = {
  tenantConfig: Signal<TenantConfig | null>;
  errorMessage: Signal<string>;
  calYear: Signal<number>;
  calMonth: Signal<number>;
  selectedDate: Signal<CalendarDate | null>;
  selectedTime: Signal<string>;
  blockedDates: Signal<Set<string>>;
  /** Dates the venue is closed, as resolved by the server (weekly closures and special hours). */
  closedDates: Signal<Set<string>>;
  blockedTimes: Signal<string[]>;
  daySlots: Signal<string[] | null>;
  isFetchingTimes: Signal<boolean>;
  goToOverview: () => void;
  saveDatetime: () => Promise<void>;
  fetchBlockedDatesForMonth: (year: number, month: number) => Promise<void>;
  selectDate: (year: number, month: number, day: number) => Promise<void>;
};

export const ChangeDateTime: FunctionComponent<ChangeDateTimeProps> = ({
  tenantConfig,
  errorMessage,
  calYear,
  calMonth,
  selectedDate,
  selectedTime,
  blockedDates,
  closedDates,
  blockedTimes,
  daySlots,
  isFetchingTimes,
  goToOverview,
  saveDatetime,
  fetchBlockedDatesForMonth,
  selectDate,
}) => {
  const tooltipAnchor = useSignal<HTMLElement | null>(null);
  const isSaving = useSignal(false);

  // Day cells are reused across months, so an open tip would end up on the same day number of the new month.
  useEffect(() => {
    tooltipAnchor.value = null;
  }, [calYear.value, calMonth.value]);

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  function isBeforeToday(y: number, m: number, d: number): boolean {
    if (y !== todayYear) return y < todayYear;
    if (m !== todayMonth) return m < todayMonth;
    return d < todayDay;
  }

  function isDateUnavailable(y: number, m: number, d: number): boolean {
    if (isBeforeToday(y, m, d)) return true;
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return blockedDates.value.has(dateStr) || closedDates.value.has(dateStr);
  }

  function isDateBlocked(y: number, m: number, d: number): boolean {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return blockedDates.value.has(dateStr);
  }

  function handleBlockedSelect(_y: number, _m: number, _d: number, el: HTMLElement) {
    tooltipAnchor.value = el;
  }

  async function prevMonth() {
    if (calYear.value === todayYear && calMonth.value === todayMonth) return;
    tooltipAnchor.value = null;
    let newMonth = calMonth.value - 1;
    let newYear = calYear.value;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    calYear.value = newYear;
    calMonth.value = newMonth;
    await fetchBlockedDatesForMonth(newYear, newMonth);
  }

  async function nextMonth() {
    tooltipAnchor.value = null;
    let newMonth = calMonth.value + 1;
    let newYear = calYear.value;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    calYear.value = newYear;
    calMonth.value = newMonth;
    await fetchBlockedDatesForMonth(newYear, newMonth);
  }

  const available = selectedDate.value ? getAvailableSlots(selectedDate.value, tenantConfig.value, blockedTimes.value, daySlots.value) : [];

  const timeOptions = available.map((s) => ({ value: s, label: s }));
  const canSave = !!(selectedDate.value && selectedTime.value);
  const onCurrentMonth = calYear.value === todayYear && calMonth.value === todayMonth;
  const tooltipOpen = tooltipAnchor.value !== null;

  async function handleSave() {
    isSaving.value = true;
    await saveDatetime();
    isSaving.value = false;
  }

  return (
    <StandaloneLayout title="Change Date & Time">
      <p class="m-0">Choose a new date and time for your reservation.</p>
      <ErrorAlert message={errorMessage.value} />

      {selectedDate.value && <SelectedDateInfo date={selectedDate.value} hideLabel={true} />}

      <div class="bg-base-100 rounded-field w-full p-6 max-[480px]:p-4" role="region" aria-label="Date picker">
        <div class="mb-6 flex items-center justify-between">
          <h2 class="m-0 text-2xl">
            {MONTH_NAMES[calMonth.value]} {calYear.value}
          </h2>
          <Join>
            <Button class="join-item" shape="square" aria-label="Previous month" disabled={onCurrentMonth} onClick={prevMonth}>
              <ChevronLeft />
            </Button>
            <Button class="join-item" shape="square" aria-label="Next month" onClick={nextMonth}>
              <ChevronRight />
            </Button>
          </Join>
        </div>
        <Calendar
          year={calYear.value}
          month={calMonth.value}
          selectedDate={selectedDate.value}
          isDisabled={(y, m, d) => isDateUnavailable(y, m, d)}
          isBlocked={(y, m, d) => isDateBlocked(y, m, d)}
          onSelect={(y, m, d) => selectDate(y, m, d)}
          onBlockedSelect={handleBlockedSelect}
        />
        <FloatingTooltip
          open={tooltipOpen}
          anchor={tooltipAnchor.value}
          timeout={BLOCKED_TIP_MS}
          onClose={() => {
            tooltipAnchor.value = null;
          }}
        >
          {BLOCKED_MESSAGE}
        </FloatingTooltip>
        {/* A description added to the focused day is not announced, so the tip's message is also written here. */}
        <p role="status" class="sr-only">
          {tooltipOpen ? BLOCKED_MESSAGE : ''}
        </p>
      </div>

      {selectedDate.value &&
        (isFetchingTimes.value ? (
          <FieldsetMessage label="Time">
            <div class="flex items-center gap-3">
              <Loading size="sm" label="Loading available times" />
              <span aria-hidden="true">Loading times...</span>
            </div>
          </FieldsetMessage>
        ) : available.length > 0 ? (
          <Fieldset label="Time">
            <Select
              id="mb-time-select"
              value={selectedTime.value}
              options={timeOptions}
              placeholder="Select a time"
              onChange={(e) => {
                selectedTime.value = (e.target as HTMLSelectElement).value;
              }}
            />
          </Fieldset>
        ) : (
          <FieldsetMessage label="Time">
            <p class="text-error m-0">No times available for this date. Please try a different date.</p>
          </FieldsetMessage>
        ))}

      <div class="grid gap-3 sm:grid-cols-2">
        <Button onClick={goToOverview}>
          <ArrowLeft />
          Back
        </Button>
        <Button variant="primary" disabled={!canSave} isLoading={isSaving.value} onClick={handleSave}>
          {isSaving.value ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </StandaloneLayout>
  );
};
