import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateToString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isToday(d: Date): boolean {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

interface DateNavProps {
  currentDate: Signal<Date>;
  guestCount: number;
  onPrev: () => void;
  onNext: () => void;
}

const DateNav: FunctionComponent<DateNavProps> = ({ currentDate, guestCount, onPrev, onNext }) => {
  const d = currentDate.value;
  const displayDate = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
  const todayFlag = isToday(d);

  return (
    <div class="date-nav">
      <button class="btn-action" onClick={onPrev} aria-label="Previous day">&#8592;</button>
      <div class="date-nav-center">
        <span id="current-date-display">
          {displayDate}
          {todayFlag && <span class="today-label"> today</span>}
        </span>
        <span id="summary-text" class="day-summary">
          {guestCount} cover{guestCount !== 1 ? 's' : ''}
        </span>
      </div>
      <button class="btn-action" onClick={onNext} aria-label="Next day">&#8594;</button>
    </div>
  );
};

export default DateNav;
