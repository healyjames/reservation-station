import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { MONTHS } from '@shared/types';
import { CalendarGrid, BlockedTooltip } from '@shared/components';

interface CalendarProps {
  year: number;
  month: number;
  selectedDate: CalendarDate | null;
  blockedDates: Set<string>;
  onMonthChange: (year: number, month: number) => Promise<void>;
  onDateSelect: (year: number, month: number, day: number) => Promise<void>;
}

export const Calendar: FunctionComponent<CalendarProps> = ({
  year, month, selectedDate, blockedDates, onMonthChange, onDateSelect
}) => {
  const tooltipVisible = useSignal(false);
  const tooltipAnchorRect = useSignal<DOMRect | null>(null);
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  useEffect(() => {
    onMonthChange(year, month);
  }, []);

  function isBeforeToday(y: number, m: number, d: number): boolean {
    if (y !== todayYear) return y < todayYear;
    if (m !== todayMonth) return m < todayMonth;
    return d < todayDay;
  }

  function isDateBlocked(y: number, m: number, d: number): boolean {
    return blockedDates.has(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  function prevMonth() {
    if (year === todayYear && month === todayMonth) return;
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    onMonthChange(newYear, newMonth);
  }

  function nextMonth() {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) { newMonth = 0; newYear += 1; }
    onMonthChange(newYear, newMonth);
  }

  function handleBlockedSelect(_y: number, _m: number, _d: number, el: HTMLDivElement) {
    tooltipAnchorRect.value = el.getBoundingClientRect();
    tooltipVisible.value = true;
    setTimeout(() => { tooltipVisible.value = false; }, 3000);
  }

  const onCurrentMonth = year === todayYear && month === todayMonth;

  return (
    <div class="calendar-container" role="region" aria-label="Date picker">
      <div class="calendar-header">
        <h2 id="calendar-title">{MONTHS[month]} {year}</h2>
        <div class="calendar-nav">
          <button
            id="prev-month"
            aria-label="Previous month"
            disabled={onCurrentMonth}
            onClick={prevMonth}
          >&#8592;</button>
          <button
            id="next-month"
            aria-label="Next month"
            onClick={nextMonth}
          >&#8594;</button>
        </div>
      </div>
      <CalendarGrid
        year={year}
        month={month}
        selectedDate={selectedDate}
        isDisabled={(y, m, d) => isBeforeToday(y, m, d) || isDateBlocked(y, m, d)}
        isBlocked={(y, m, d) => isDateBlocked(y, m, d)}
        onSelect={onDateSelect}
        onBlockedSelect={handleBlockedSelect}
      />
      <BlockedTooltip
        visible={tooltipVisible.value}
        message="Bookings currently unavailable for this date"
        anchorRect={tooltipAnchorRect.value}
        onClose={() => { tooltipVisible.value = false; }}
      />
    </div>
  );
};
