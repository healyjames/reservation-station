import { loadTenant, tenantConfig } from './tenants.js';
import { MONTHS, renderCalendarGrid } from './calendar-core.js';

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
  const titleEl = document.getElementById('calendar-title');
  const gridEl  = document.getElementById('calendar-grid');
  const prevBtn = document.getElementById('prev-month');

  titleEl.textContent = `${MONTHS[month]} ${year}`;

  const onCurrentMonth = year === todayYear && month === todayMonth;
  prevBtn.disabled = onCurrentMonth;

  renderCalendarGrid(gridEl, year, month, {
    selectedDate,
    isDisabled: (y, m, d) => {
      const past = isBeforeToday(y, m, d);
      const blockedToday = y === todayYear && m === todayMonth && d === todayDay &&
                           tenantConfig?.block_current_day === true;
      return past || blockedToday;
    },
    onSelect: (y, m, d) => selectDay(y, m, d),
    cellClass: 'calendar-day',
    headerClass: 'day-name',
  });
}

function selectDay(year, month, day) {
  selectedDate = { year, month, day };

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
