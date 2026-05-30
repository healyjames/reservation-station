import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { TenantConfig, CalendarDate } from '@shared/types';
import { MONTHS } from '@shared/types';
import {
  StandaloneLayout,
  CalendarGrid,
  BlockedTooltip,
  SelectedDateInfo,
  Select,
  Button,
  Spinner,
  MessageCard,
  FormField,
} from '@shared/components';
import { getAvailableSlots } from '@shared/utils';
import styles from './ChangeDateTime.module.css';

interface ChangeDateTimeProps {
  tenantConfig: Signal<TenantConfig | null>;
  errorMessage: Signal<string>;
  calYear: Signal<number>;
  calMonth: Signal<number>;
  selectedDate: Signal<CalendarDate | null>;
  selectedTime: Signal<string>;
  blockedDates: Signal<Set<string>>;
  blockedTimes: Signal<string[]>;
  isFetchingTimes: Signal<boolean>;
  goToOverview: () => void;
  saveDatetime: () => Promise<void>;
  fetchBlockedDatesForMonth: (year: number, month: number) => Promise<void>;
  selectDate: (year: number, month: number, day: number) => Promise<void>;
}

export const ChangeDateTime: FunctionComponent<ChangeDateTimeProps> = ({
  tenantConfig,
  errorMessage,
  calYear,
  calMonth,
  selectedDate,
  selectedTime,
  blockedDates,
  blockedTimes,
  isFetchingTimes,
  goToOverview,
  saveDatetime,
  fetchBlockedDatesForMonth,
  selectDate,
}) => {
  const tooltipVisible = useSignal(false);
  const tooltipAnchorRect = useSignal<DOMRect | null>(null);
  const isSaving = useSignal(false);

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
    if (blockedDates.value.has(dateStr)) return true;
    const hours = tenantConfig.value?.opening_hours;
    if (hours && hours.length > 0) {
      const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
      const entry = hours.find(h => Number(h.day_of_week) === dow);
      if (!entry || !!entry.is_closed) return true;
    }
    return false;
  }

  function isDateBlocked(y: number, m: number, d: number): boolean {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return blockedDates.value.has(dateStr);
  }

  function handleBlockedSelect(_y: number, _m: number, _d: number, el: HTMLDivElement) {
    tooltipAnchorRect.value = el.getBoundingClientRect();
    tooltipVisible.value = true;
    setTimeout(() => { tooltipVisible.value = false; }, 3000);
  }

  async function prevMonth() {
    if (calYear.value === todayYear && calMonth.value === todayMonth) return;
    let newMonth = calMonth.value - 1;
    let newYear = calYear.value;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    calYear.value = newYear;
    calMonth.value = newMonth;
    await fetchBlockedDatesForMonth(newYear, newMonth);
  }

  async function nextMonth() {
    let newMonth = calMonth.value + 1;
    let newYear = calYear.value;
    if (newMonth > 11) { newMonth = 0; newYear += 1; }
    calYear.value = newYear;
    calMonth.value = newMonth;
    await fetchBlockedDatesForMonth(newYear, newMonth);
  }

  const available = selectedDate.value
    ? getAvailableSlots(selectedDate.value, tenantConfig.value, blockedTimes.value)
    : [];

  const timeOptions = available.map(s => ({ value: s, label: s }));
  const canSave = !!(selectedDate.value && selectedTime.value);
  const onCurrentMonth = calYear.value === todayYear && calMonth.value === todayMonth;

  async function handleSave() {
    isSaving.value = true;
    await saveDatetime();
    isSaving.value = false;
  }

  return (
    <StandaloneLayout title="Change Date & Time">
      <p class={styles.subtitle}>Choose a new date and time for your reservation.</p>
      {errorMessage.value && (
        <MessageCard variant="error" title="Something went wrong">
          <p>{errorMessage.value}</p>
        </MessageCard>
      )}

			{selectedDate.value && (
				<SelectedDateInfo date={selectedDate.value} hideLabel={true} />
			)}

      <div class={styles.container} role="region" aria-label="Date picker">
        <div class={styles.header}>
          <h2>{MONTHS[calMonth.value]} {calYear.value}</h2>
          <div class={styles.nav}>
            <button
              type="button"
              class={styles.nav_btn}
              aria-label="Previous month"
              disabled={onCurrentMonth}
              onClick={prevMonth}
            >
              &#8592;
            </button>
            <button
              type="button"
              class={styles.nav_btn}
              aria-label="Next month"
              onClick={nextMonth}
            >
              &#8594;
            </button>
          </div>
        </div>
        <CalendarGrid
          year={calYear.value}
          month={calMonth.value}
          selectedDate={selectedDate.value}
          isDisabled={(y, m, d) => isDateUnavailable(y, m, d)}
          isBlocked={(y, m, d) => isDateBlocked(y, m, d)}
          onSelect={(y, m, d) => selectDate(y, m, d)}
          onBlockedSelect={handleBlockedSelect}
        />
        <BlockedTooltip
          visible={tooltipVisible.value}
          message="Bookings currently unavailable for this date"
          anchorRect={tooltipAnchorRect.value}
          onClose={() => { tooltipVisible.value = false; }}
        />
      </div>

			{selectedDate.value && (
        <div>
          <FormField label="Time" htmlFor="mb-time-select">
            {isFetchingTimes.value ? (
              <div class={`${styles.loading_indicator} ${styles.compact_loading}`}>
                <Spinner size="sm" label="Loading available times" />
                <span>Loading times...</span>
              </div>
            ) : available.length > 0 ? (
              <Select
                id="mb-time-select"
                value={selectedTime.value}
                options={timeOptions}
                placeholder="Select a time"
                onChange={(e) => { selectedTime.value = (e.target as HTMLSelectElement).value; }}
              />
            ) : (
              <p class={`${styles.inline_helper} ${styles.inline_helper_error}`}>
                No times available for this date. Please try a different date.
              </p>
            )}
          </FormField>
        </div>
      )}

      <div class={`${styles.action_group} mt-2`}>
        <Button type="button" variant="secondary" onClick={goToOverview}>← Back</Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canSave}
          isLoading={isSaving.value}
          onClick={handleSave}
        >
          {isSaving.value ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </StandaloneLayout>
  );
};

