import type { FunctionComponent, JSX } from 'preact';
import { DAY_NAMES, MONTH_NAMES } from '@constants';
import type { CalendarDate } from '@shared/types';
import { cx } from '@shared/utils/cx';
import CalendarDay from './CalendarDay';
import type { CalendarRange, CalendarRangeMode } from './CalendarDay';

type DayPredicate = (year: number, month: number, day: number) => boolean;
type DayCallback = (year: number, month: number, day: number) => void;

type OwnedAttributes = 'class' | 'className' | 'children' | 'role' | 'aria-label' | 'aria-labelledby';

export type CalendarProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, OwnedAttributes> & {
  /** Classes for the grid. Other attributes (`id`, `onMouseLeave`, `data-*`…) go on it too. */
  class?: string;
  year: number;
  /** 0-indexed: 0 = January. */
  month: number;
  selectedDate?: CalendarDate | null;
  /** Not selectable. Past days are disabled too, unless `allowPastDates`. */
  isDisabled?: DayPredicate;
  /** Blocked (struck through). A blocked day that is also disabled stays focusable and calls `onBlockedSelect`. Never applies to past days. */
  isBlocked?: DayPredicate;
  allowPastDates?: boolean;
  /** Range preview: one value per day; the first match of start, end, middle wins. */
  isRangeStart?: DayPredicate;
  isInRange?: DayPredicate;
  isRangeEnd?: DayPredicate;
  rangeMode?: CalendarRangeMode;
  onSelect?: DayCallback;
  /** A disabled blocked day was clicked or activated; `el` is the anchor for a ui/FloatingTooltip. */
  onBlockedSelect?: (year: number, month: number, day: number, el: HTMLElement) => void;
  onHoverDate?: DayCallback;
};

const isBefore = (a: CalendarDate, b: CalendarDate) =>
  a.year !== b.year ? a.year < b.year : a.month !== b.month ? a.month < b.month : a.day < b.day;

const isSameDay = (a: CalendarDate, b: CalendarDate) => a.year === b.year && a.month === b.month && a.day === b.day;

/**
 * A Monday-first month grid styled like daisyUI's calendar (which only skins third-party pickers). Keeps the legacy
 * semantics: `role="grid"` named by month, `columnheader`s, selectable days as `role="button"` + `aria-pressed` with
 * Enter/Space, disabled days as `aria-disabled` gridcells, leading empties `aria-hidden`. Today has `aria-current="date"`.
 * State is on each day as `data-today`, `data-past`, `data-selected`, `data-blocked`, `data-range`, `data-range-mode`.
 */
const Calendar: FunctionComponent<CalendarProps> = ({
  year,
  month,
  selectedDate,
  isDisabled,
  isBlocked,
  allowPastDates = false,
  isRangeStart,
  isInRange,
  isRangeEnd,
  rangeMode = 'block',
  onSelect,
  onBlockedSelect,
  onHoverDate,
  class: className,
  ...rest
}) => {
  const now = new Date();
  const today: CalendarDate = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };

  // Monday-first: Sunday (0) has 6 leading empties, Monday to Saturday have getDay() - 1.
  const firstWeekday = new Date(year, month, 1).getDay();
  const leadingEmpties = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const rangeOf = (day: number): CalendarRange | undefined => {
    if (isRangeStart?.(year, month, day)) return 'start';
    if (isRangeEnd?.(year, month, day)) return 'end';
    if (isInRange?.(year, month, day)) return 'middle';
    return undefined;
  };

  return (
    // TypeScript never checks hyphenated JSX attributes, so aria-labelledby is also cleared at runtime.
    <div
      {...rest}
      role="grid"
      aria-label={`${MONTH_NAMES[month]} ${year}`}
      aria-labelledby={undefined}
      class={cx('grid grid-cols-7 gap-2', className)}
    >
      {DAY_NAMES.map((name) => (
        <div key={name} role="columnheader" class="text-base-content/70 text-center text-sm font-semibold min-[480px]:p-2">
          {name}
        </div>
      ))}

      {Array.from({ length: leadingEmpties }, (_, i) => (
        <div key={`empty-${i}`} class="aspect-square" aria-hidden="true" />
      ))}

      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const date: CalendarDate = { year, month, day };
        const isPast = isBefore(date, today);
        const disabled = isDisabled?.(year, month, day) ?? false;
        return (
          <CalendarDay
            key={day}
            day={day}
            isToday={isSameDay(date, today)}
            isPast={isPast}
            isSelected={selectedDate != null && isSameDay(date, selectedDate)}
            isBlocked={!isPast && (isBlocked?.(year, month, day) ?? false)}
            isDisabled={disabled || (isPast && !allowPastDates)}
            range={rangeOf(day)}
            rangeMode={rangeMode}
            onSelect={() => onSelect?.(year, month, day)}
            onBlockedSelect={(el) => onBlockedSelect?.(year, month, day, el)}
            onMouseEnter={() => onHoverDate?.(year, month, day)}
          />
        );
      })}
    </div>
  );
};

export default Calendar;
