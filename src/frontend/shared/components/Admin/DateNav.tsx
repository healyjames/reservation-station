import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import { Badge, Button, Join, Stat } from '@shared/components/ui';
import { ChevronLeft, ChevronRight } from '@shared/components/ui/icons';

function isToday(d: Date): boolean {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

type DateNavProps = {
  currentDate: Signal<Date>;
  guestCount: number;
  onPrev: () => void;
  onNext: () => void;
  onOpenCalendar?: () => void;
};

/** The Bookings day: previous/next day, the date (opens the date picker), a "Today" badge and the day's covers. */
const DateNav: FunctionComponent<DateNavProps> = ({ currentDate, guestCount, onPrev, onNext, onOpenCalendar }) => {
  const d = currentDate.value;
  const displayDate = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });

  return (
    <div class="flex flex-wrap items-center justify-center gap-4">
      <Join aria-label="Day">
        <Button class="join-item h-auto" shape="square" aria-label="Previous day" onClick={onPrev}>
          <ChevronLeft />
        </Button>
        <Button
          class="join-item h-auto min-w-0 gap-3 py-2 text-xl md:min-w-[350px] md:text-[2.5rem]"
          id="current-date-display"
          onClick={onOpenCalendar}
        >
          {displayDate}
          {isToday(d) && <Badge variant="primary">Today</Badge>}
          <span class="sr-only">, choose a date</span>
        </Button>
        <Button class="join-item h-auto" shape="square" aria-label="Next day" onClick={onNext}>
          <ChevronRight />
        </Button>
      </Join>
      <Stat id="summary-text" class="bg-base-200 [&_.stat]:px-4 [&_.stat]:py-2" title="Covers" value={guestCount} />
    </div>
  );
};

export default DateNav;
