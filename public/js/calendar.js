import { loadTenant, tenantConfig } from './tenant.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
// Week starts Monday
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const _today = new Date();
const todayYear  = _today.getFullYear();
const todayMonth = _today.getMonth();
const todayDay   = _today.getDate();

let currentYear  = todayYear;
let currentMonth = todayMonth;
let selectedDate = null;

function isBeforeToday(year, month, day) {
  if (year !== todayYear)  return year < todayYear;
  if (month !== todayMonth) return month < todayMonth;
  return day < todayDay;
}

function renderCalendar(year, month) {
  const titleEl  = document.getElementById('calendar-title');
  const gridEl   = document.getElementById('calendar-grid');
  const prevBtn  = document.getElementById('prev-month');

  titleEl.textContent = `${MONTHS[month]} ${year}`;

  // Disable prev when already on the current month
  const onCurrentMonth = year === todayYear && month === todayMonth;
  prevBtn.disabled = onCurrentMonth;

  gridEl.innerHTML = '';

  // Day-of-week header row
  DAY_NAMES.forEach(name => {
    const cell = document.createElement('div');
    cell.className = 'day-name';
    cell.setAttribute('role', 'columnheader');
    cell.setAttribute('aria-label', name);
    cell.textContent = name;
    gridEl.appendChild(cell);
  });

  // Leading empty cells so day 1 lands on the right column.
  // getDay(): 0=Sun, 1=Mon … 6=Sat → convert to Mon-first offset.
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const leadingEmpties = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  for (let i = 0; i < leadingEmpties; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day empty';
    cell.setAttribute('aria-hidden', 'true');
    gridEl.appendChild(cell);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    cell.textContent = day;

    const isToday   = year === todayYear && month === todayMonth && day === todayDay;
    const isPast    = isBeforeToday(year, month, day);
    const isBlockedToday = isToday && tenantConfig?.block_current_day === true;
    const isDisabled = isPast || isBlockedToday;
    const isSelected = selectedDate &&
                       selectedDate.year  === year  &&
                       selectedDate.month === month &&
                       selectedDate.day   === day;

    if (isToday)    cell.classList.add('today');
    if (isDisabled) cell.classList.add('past');
    if (isSelected) cell.classList.add('selected');

    if (isDisabled) {
      cell.setAttribute('aria-disabled', 'true');
      cell.setAttribute('role', 'gridcell');
    } else {
      const dateLabel = new Date(year, month, day).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', dateLabel);
      cell.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      cell.setAttribute('tabindex', '0');

      cell.addEventListener('click', () => selectDay(year, month, day));
      cell.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDay(year, month, day);
        }
      });
    }

    gridEl.appendChild(cell);
  }
}

function selectDay(year, month, day) {
  selectedDate = { year, month, day };

  const formatted = new Date(year, month, day).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const display = document.getElementById('selected-date-display');
  display.innerHTML = `<strong>${formatted}</strong>`;

  renderCalendar(currentYear, currentMonth);

  // Import and show booking form
  import('./booking-form.js').then(module => {
    module.showBookingForm({ year, month, day });
  });
}

document.getElementById('prev-month').addEventListener('click', () => {
  if (currentYear === todayYear && currentMonth === todayMonth) return;
  currentMonth -= 1;
  if (currentMonth < 0) { currentMonth = 11; currentYear -= 1; }
  renderCalendar(currentYear, currentMonth);
});

document.getElementById('next-month').addEventListener('click', () => {
  currentMonth += 1;
  if (currentMonth > 11) { currentMonth = 0; currentYear += 1; }
  renderCalendar(currentYear, currentMonth);
});

// Load tenant config then initialise the calendar
(async () => {
  await loadTenant();

  if (!tenantConfig) {
    const container = document.getElementById('calendar-container');
    container.innerHTML = `
      <div class="error-container" style="display:block; margin: 24px;">
        Unable to load booking configuration. Please check the URL and try again.
      </div>
    `;
    return;
  }

  renderCalendar(currentYear, currentMonth);
})();
