// DayCell has no separate CSS module.
// Its styles are defined in CalendarGrid.module.css and passed in via the `styles` prop.
// This avoids a circular CSS Module reference between DayCell and CalendarGrid.

import { useRef } from 'preact/hooks';
import type { FunctionComponent } from 'preact';

interface DayCellProps {
  day: number;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  isBlocked: boolean;
  isDisabled: boolean;
  isRangeStart?: boolean;
  isInRange?: boolean;
  isRangeEnd?: boolean;
  onSelect?: () => void;
  onBlockedSelect?: (el: HTMLDivElement) => void;
  onMouseEnter?: () => void;
  /** CSS module classnames passed from CalendarGrid — DayCell receives the module object rather than importing it directly */
  styles: Record<string, string>;
}

const DayCell: FunctionComponent<DayCellProps> = ({
  day, isToday, isPast, isSelected, isBlocked, isDisabled,
  isRangeStart, isInRange, isRangeEnd,
  onSelect, onBlockedSelect, onMouseEnter, styles
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const classNames = [
    styles.day,
    isToday ? styles.today : '',
    isPast ? styles.past : '',
    isSelected ? styles.selected : '',
    isBlocked ? styles.blocked : '',
    isRangeStart ? styles.rangeStart : '',
    isInRange ? styles.inRange : '',
    isRangeEnd ? styles.rangeEnd : '',
  ].filter(Boolean).join(' ');

  // Past + not blocked: purely disabled, no interaction
  if (isDisabled && !isBlocked) {
    return (
      <div class={classNames} aria-disabled="true" role="gridcell">
        {day}
      </div>
    );
  }

  // Blocked (non-past): shows tooltip on click/keyboard
  if (isDisabled && isBlocked) {
    return (
      <div
        ref={ref}
        class={classNames}
        aria-disabled="true"
        role="gridcell"
        tabIndex={0}
        onClick={() => ref.current && onBlockedSelect?.(ref.current)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            ref.current && onBlockedSelect?.(ref.current);
          }
        }}
      >
        {day}
      </div>
    );
  }

  // Normal selectable day
  return (
    <div
      class={classNames}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      {day}
    </div>
  );
};

export default DayCell;
