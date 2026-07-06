import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { MONTH_NAMES } from '@constants';
import { CalendarGrid, Tooltip, Button } from '@shared/components';
import styles from './Calendar.module.css';

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
}

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
}) => {
  const tooltipVisible = useSignal(false);
  const tooltipAnchorRect = useSignal<DOMRect | null>(null);
  const tooltipMessage = useSignal('');
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
    return !!blockedDates?.has(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  function isDateClosed(y: number, m: number, d: number): boolean {
    const cd = closedDates ?? new Set<string>();
    return cd.has(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  function prevMonth() {
    if (!allowPastDates && year === todayYear && month === todayMonth) return;
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    onMonthChange(newYear, newMonth);
  }

  function nextMonth() {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    onMonthChange(newYear, newMonth);
  }

  function handleBlockedSelect(y: number, m: number, d: number, el: HTMLDivElement) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cd = closedDates ?? new Set<string>();
    tooltipMessage.value = cd.has(dateStr)
      ? 'Closed'
      : 'Online bookings are no longer available for this date. Please call the venue instead';
    tooltipAnchorRect.value = el.getBoundingClientRect();
    tooltipVisible.value = true;
    setTimeout(() => {
      tooltipVisible.value = false;
    }, 3000);
  }

  const onCurrentMonth = year === todayYear && month === todayMonth;

  return (
    <div class={styles.container} role="region" aria-labelledby="calendar-title">
      {isStandalone && (
        <div class={styles.welcome}>
          <h1 class={styles.welcome_title}>{tenantName ? `${tenantName} Reservations` : 'Make a Reservation'}</h1>
          <p class={styles.welcome_subtitle}>Select a date below to check availability and book your table.</p>
        </div>
      )}
      <div class={styles.header}>
        <div class={styles.nav}>
          <Button
            type="button"
            class={styles.nav_button}
            aria-label="Previous month"
            disabled={(!allowPastDates && onCurrentMonth) || isFetchingDates}
            onClick={prevMonth}
            size="sm"
            variant="ghost"
          >
            &#8592;
          </Button>
          <h2 id="calendar-title">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Button
            type="button"
            class={styles.nav_button}
            aria-label="Next month"
            disabled={isFetchingDates}
            onClick={nextMonth}
            size="sm"
            variant="ghost"
          >
            &#8594;
          </Button>
        </div>
      </div>

      {blockedDatesError && (
        <div
          role="alert"
          style={`display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:8px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;font-size:13px;color:#664d03;${isStandalone && 'max-width: 800px; margin: 1rem auto;'}`}
        >
          <span style="flex:1">{blockedDatesError}</span>
          <Button type="button" size="sm" variant="primary" onClick={() => onMonthChange(year, month)}>
            Retry
          </Button>
        </div>
      )}

      <div
        style={{
          ...(isFetchingDates && {
            opacity: 0.5,
            pointerEvents: 'none',
          }),
          ...(isStandalone && {
            padding: '1rem',
            maxWidth: '800px',
            margin: '0 auto',
          }),
        }}
      >
        <CalendarGrid
          year={year}
          month={month}
          selectedDate={selectedDate}
          isDisabled={(y, m, d) => (isFetchingDates ?? false) || (!allowPastDates && isBeforeToday(y, m, d)) || isDateBlocked(y, m, d) || isDateClosed(y, m, d)}
          isBlocked={(y, m, d) => isDateBlocked(y, m, d) || isDateClosed(y, m, d)}
          allowPastDates={allowPastDates}
          onSelect={onDateSelect}
          onBlockedSelect={handleBlockedSelect}
        />
      </div>

      <Tooltip
        visible={tooltipVisible.value}
        message={tooltipMessage.value}
        anchorRect={tooltipAnchorRect.value}
        onClose={() => {
          tooltipVisible.value = false;
        }}
      />
    </div>
  );
};
