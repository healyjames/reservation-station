import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { MONTH_NAMES } from '@constants';
import { Alert, Button, Calendar as CalendarGrid, FloatingTooltip, Join } from '@shared/components/ui';
import { ChevronLeft, ChevronRight } from '@shared/components/ui/icons';
import { cx } from '@shared/utils/cx';

type CalendarProps = {
  year: number;
  month: number;
  selectedDate: CalendarDate | null;
  blockedDates: Set<string>;
  closedDates?: Set<string>;
  blockedDatesError?: string;
  isFetchingDates?: boolean;
  onMonthChange: (year: number, month: number) => Promise<void>;
  onDateSelect: (year: number, month: number, day: number) => Promise<void>;
  isStandalone?: boolean;
  tenantName?: string;
  allowPastDates?: boolean;
  /** The month heading's level: 2 in the booking widget, 3 where the calendar sits under a section heading. */
  headingLevel?: 2 | 3;
};

const BLOCKED_TIP_MS = 3000;

export const Calendar: FunctionComponent<CalendarProps> = ({
  year,
  month,
  selectedDate,
  blockedDates,
  closedDates,
  blockedDatesError,
  isFetchingDates,
  onMonthChange,
  onDateSelect,
  isStandalone = false,
  tenantName,
  allowPastDates = false,
  headingLevel = 2,
}) => {
  const MonthHeading = headingLevel === 3 ? 'h3' : 'h2';
  const tooltipAnchor = useSignal<HTMLElement | null>(null);
  const tooltipMessage = useSignal('');
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  useEffect(() => {
    onMonthChange(year, month);
  }, []);

  // Day cells are reused across months, so an open tip would end up on the same day number of the new month.
  useEffect(() => {
    tooltipAnchor.value = null;
  }, [year, month]);

  function isBeforeToday(y: number, m: number, d: number): boolean {
    if (y !== todayYear) return y < todayYear;
    if (m !== todayMonth) return m < todayMonth;
    return d < todayDay;
  }

  function isDateBlocked(y: number, m: number, d: number): boolean {
    return !!blockedDates?.has(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  function isDateClosed(y: number, m: number, d: number): boolean {
    const cd = closedDates ?? new Set<string>();
    return cd.has(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  function prevMonth() {
    if (!allowPastDates && year === todayYear && month === todayMonth) return;
    closeTooltip();
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    onMonthChange(newYear, newMonth);
  }

  function nextMonth() {
    closeTooltip();
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    onMonthChange(newYear, newMonth);
  }

  function handleBlockedSelect(y: number, m: number, d: number, el: HTMLElement) {
    tooltipMessage.value = isDateClosed(y, m, d)
      ? 'Closed'
      : 'Online bookings are no longer available for this date. Please call the venue instead';
    tooltipAnchor.value = el;
  }

  function closeTooltip() {
    tooltipAnchor.value = null;
  }

  const onCurrentMonth = year === todayYear && month === todayMonth;
  const tooltipOpen = tooltipAnchor.value !== null;

  return (
    <div class="bg-base-100 p-6 max-[480px]:p-4" role="region" aria-labelledby="calendar-title">
      {isStandalone && (
        <div class="border-base-300 mb-6 border-b px-4 pt-8 pb-6 text-center">
          <h1 class="mt-0 mb-2 text-[1.75rem] leading-tight font-bold">
            {tenantName ? `${tenantName} Reservations` : 'Make a Reservation'}
          </h1>
          <p class="text-base-content/70 m-0">Select a date below to check availability and book your table.</p>
        </div>
      )}

      <div class="mb-6 flex justify-center">
        <Join>
          <Button
            class="join-item"
            shape="square"
            aria-label="Previous month"
            disabled={(!allowPastDates && onCurrentMonth) || isFetchingDates}
            onClick={prevMonth}
          >
            <ChevronLeft />
          </Button>
          <MonthHeading id="calendar-title" class="join-item border-base-300 m-0 flex items-center px-4 text-[2rem] leading-tight">
            {MONTH_NAMES[month]} {year}
          </MonthHeading>
          <Button class="join-item" shape="square" aria-label="Next month" disabled={isFetchingDates} onClick={nextMonth}>
            <ChevronRight />
          </Button>
        </Join>
      </div>

      {blockedDatesError && (
        <Alert
          variant="warning"
          live="assertive"
          class={isStandalone ? 'mx-auto my-4 max-w-[800px]' : 'mb-2'}
          action={
            <Button size="sm" variant="primary" onClick={() => onMonthChange(year, month)}>
              Retry
            </Button>
          }
        >
          {blockedDatesError}
        </Alert>
      )}

      <div class={cx(isFetchingDates && 'pointer-events-none opacity-50', isStandalone && 'mx-auto max-w-[800px] p-4')}>
        <CalendarGrid
          year={year}
          month={month}
          selectedDate={selectedDate}
          isDisabled={(y, m, d) =>
            (isFetchingDates ?? false) || (!allowPastDates && isBeforeToday(y, m, d)) || isDateBlocked(y, m, d) || isDateClosed(y, m, d)
          }
          isBlocked={(y, m, d) => isDateBlocked(y, m, d) || isDateClosed(y, m, d)}
          allowPastDates={allowPastDates}
          onSelect={onDateSelect}
          onBlockedSelect={handleBlockedSelect}
        />
      </div>

      <FloatingTooltip open={tooltipOpen} anchor={tooltipAnchor.value} timeout={BLOCKED_TIP_MS} onClose={closeTooltip}>
        {tooltipMessage.value}
      </FloatingTooltip>
      {/* A description added to the focused day is not announced, so the tip's message is also written here. */}
      <p role="status" class="sr-only">
        {tooltipOpen ? tooltipMessage.value : ''}
      </p>
    </div>
  );
};
