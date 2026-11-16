import type { FunctionComponent, JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { cx } from '@shared/utils/cx';
import Status from '../Status';

export type CalendarRange = 'start' | 'middle' | 'end';
export type CalendarRangeMode = 'block' | 'unblock';

export type CalendarDayProps = {
  day: number;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  isBlocked: boolean;
  /** Not selectable: a plain gridcell, or a focusable one that explains itself when `isBlocked`. */
  isDisabled: boolean;
  range?: CalendarRange;
  rangeMode: CalendarRangeMode;
  onSelect: () => void;
  onBlockedSelect: (el: HTMLElement) => void;
  onMouseEnter: () => void;
};

const BASE_CLASSES =
  'relative flex aspect-square items-center justify-center rounded-field border text-sm font-medium transition-colors select-none max-sm:text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary';

/**
 * One surface per cell, chosen in order range > selected > blocked > default, so colours never fight. Differs from legacy:
 * unblock uses `error` (legacy a darker error), and the selected day keeps its colour on hover (legacy's hover rule won).
 */
const RANGE_CLASSES: Record<CalendarRangeMode, Record<CalendarRange, string>> = {
  block: {
    start: 'border-primary bg-primary font-semibold text-primary-content',
    middle: 'border-transparent bg-primary/15',
    end: 'border-primary bg-primary font-semibold text-primary-content',
  },
  unblock: {
    start: 'border-error bg-error font-semibold text-error-content',
    middle: 'border-transparent bg-error/15',
    end: 'border-error bg-error font-semibold text-error-content',
  },
};

const SELECTED_CLASSES = 'border-primary bg-primary font-semibold text-primary-content';
const BLOCKED_SURFACE_CLASSES =
  'border-base-300 bg-[repeating-linear-gradient(-45deg,var(--color-base-200),var(--color-base-200)_3px,var(--color-base-100)_3px,var(--color-base-100)_7px)]';
const DEFAULT_SURFACE_CLASSES = 'border-base-300 bg-base-200';
/** Blocked days keep their strike-through and dimming under a range tint. */
const BLOCKED_MARK_CLASSES = 'line-through opacity-55 hover:opacity-70';

const onActivateKey = (action: () => void) => (event: JSX.TargetedKeyboardEvent<HTMLElement>) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  action();
};

/** A day in ui/Calendar. State is exposed as `data-*` and ARIA; the classes only draw it. */
const CalendarDay: FunctionComponent<CalendarDayProps> = ({
  day,
  isToday,
  isPast,
  isSelected,
  isBlocked,
  isDisabled,
  range,
  rangeMode,
  onSelect,
  onBlockedSelect,
  onMouseEnter,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  // Compared with undefined, not negated: Tailwind reads the negated name as daisyUI's important range-slider class.
  const plainSurface = range === undefined && !isSelected;
  // Hover lightens only a plain, selectable, current-or-future day, as in legacy.
  const hoverable = !isDisabled && !isBlocked && !isPast && plainSurface;

  const state = {
    'aria-current': isToday ? ('date' as const) : undefined,
    'data-today': isToday || undefined,
    'data-past': isPast || undefined,
    'data-selected': isSelected || undefined,
    'data-blocked': isBlocked || undefined,
    'data-range': range,
    'data-range-mode': range ? rangeMode : undefined,
    class: cx(
      BASE_CLASSES,
      range
        ? RANGE_CLASSES[rangeMode][range]
        : isSelected
          ? SELECTED_CLASSES
          : isBlocked
            ? BLOCKED_SURFACE_CLASSES
            : DEFAULT_SURFACE_CLASSES,
      isBlocked && BLOCKED_MARK_CLASSES,
      isPast && 'opacity-30',
      isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
      hoverable && 'hover:bg-base-100',
      isToday && 'border-2',
      isToday && plainSurface && 'border-primary',
    ),
  };

  const content = (
    <>
      {day}
      {isToday && <Status color="primary" size="sm" class="absolute bottom-1.5 left-1/2 -translate-x-1/2" />}
    </>
  );

  if (isDisabled && !isBlocked) {
    return (
      <div {...state} role="gridcell" aria-disabled="true">
        {content}
      </div>
    );
  }

  if (isDisabled) {
    const explain = () => ref.current && onBlockedSelect(ref.current);
    return (
      <div {...state} ref={ref} role="gridcell" aria-disabled="true" tabIndex={0} onClick={explain} onKeyDown={onActivateKey(explain)}>
        {content}
      </div>
    );
  }

  return (
    <div
      {...state}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onKeyDown={onActivateKey(onSelect)}
    >
      {content}
    </div>
  );
};

export default CalendarDay;
