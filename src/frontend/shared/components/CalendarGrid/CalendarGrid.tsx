import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { MONTHS, DAY_NAMES } from '@shared/types';
import DayCell from '../DayCell';
import styles from './CalendarGrid.module.css';

interface CalendarGridProps {
  year: number;
  /** 0-indexed: 0 = January */
  month: number;
  selectedDate?: CalendarDate | null;
  isDisabled?: (year: number, month: number, day: number) => boolean;
  isBlocked?: (year: number, month: number, day: number) => boolean;
  /** When true, past dates are visually marked but remain selectable */
  allowPastDates?: boolean;
  isRangeStart?: (year: number, month: number, day: number) => boolean;
  isInRange?: (year: number, month: number, day: number) => boolean;
  isRangeEnd?: (year: number, month: number, day: number) => boolean;
  onSelect?: (year: number, month: number, day: number) => void;
  onBlockedSelect?: (year: number, month: number, day: number, el: HTMLDivElement) => void;
  onHoverDate?: (year: number, month: number, day: number) => void;
  onLeaveGrid?: () => void;
  class?: string;
}

const CalendarGrid: FunctionComponent<CalendarGridProps> = ({
  year,
  month,
  selectedDate,
  isDisabled,
  isBlocked,
  allowPastDates = false,
  isRangeStart,
  isInRange,
  isRangeEnd,
  onSelect,
  onBlockedSelect,
  onHoverDate,
  onLeaveGrid,
  class: className,
}) => {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  // Mon-first week: Sunday (0) wraps to 6 leading empties; Mon–Sat subtract 1
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const leadingEmpties = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div class={`${styles.grid} ${className ?? ''}`} role="grid" aria-label={`${MONTHS[month]} ${year}`} onMouseLeave={onLeaveGrid}>
      {/* Day name column headers */}
      {DAY_NAMES.map((name) => (
        <div key={name} class={styles.dayName} role="columnheader" aria-label={name}>
          {name}
        </div>
      ))}

      {/* Leading empty cells to align day 1 to the correct weekday column */}
      {Array.from({ length: leadingEmpties }, (_, i) => (
        <div key={`empty-${i}`} class={styles.empty} aria-hidden="true" />
      ))}

      {/* Day cells — styles object passed down so DayCell avoids a direct CSS Module import */}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const isTodayCell = year === todayYear && month === todayMonth && day === todayDay;
        const isPast =
          year < todayYear || (year === todayYear && month < todayMonth) || (year === todayYear && month === todayMonth && day < todayDay);
        const disabled = isDisabled?.(year, month, day) ?? false;
        const blocked = !isPast && (isBlocked?.(year, month, day) ?? false);
        const isSelectedCell =
          selectedDate != null && selectedDate.year === year && selectedDate.month === month && selectedDate.day === day;

        return (
          <DayCell
            key={day}
            day={day}
            isToday={isTodayCell}
            isPast={isPast}
            isSelected={isSelectedCell}
            isBlocked={blocked}
            isDisabled={allowPastDates ? disabled : disabled || isPast}
            isRangeStart={isRangeStart?.(year, month, day) ?? false}
            isInRange={isInRange?.(year, month, day) ?? false}
            isRangeEnd={isRangeEnd?.(year, month, day) ?? false}
            onSelect={() => onSelect?.(year, month, day)}
            onBlockedSelect={(el) => onBlockedSelect?.(year, month, day, el)}
            onMouseEnter={() => onHoverDate?.(year, month, day)}
            styles={styles}
          />
        );
      })}
    </div>
  );
};

export default CalendarGrid;
