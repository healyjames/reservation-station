import { loadTenant, tenantConfig } from './tenants.js';
import { MONTHS, renderCalendarGrid } from './calendar-core.js';

const _today = new Date();
const todayYear  = _today.getFullYear();
const todayMonth = _today.getMonth();
const todayDay   = _today.getDate();

let currentYear  = todayYear;
let currentMonth = todayMonth;
let selectedDate = null;
let blockedDates = new Set();

let activeTooltip = null;
let tooltipTimer  = null;

function handleOutsideClick() {
  dismissTooltip();
  document.removeEventListener('click', handleOutsideClick);
}

function dismissTooltip() {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
  clearTimeout(tooltipTimer);
  document.removeEventListener('click', handleOutsideClick);
}

function showBlockedTooltip(cell) {
  try {
    dismissTooltip();
    const container = document.getElementById('calendar-container');
    activeTooltip = document.createElement('div');
    activeTooltip.className = 'calendar-blocked-tooltip';
    activeTooltip.setAttribute('role', 'tooltip');
    activeTooltip.setAttribute('aria-live', 'polite');
    activeTooltip.textContent = 'Bookings currently unavailable for this date';
    container.appendChild(activeTooltip);
    const cellRect      = cell.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    activeTooltip.style.top  = `${cellRect.bottom - containerRect.top + 4}px`;
    activeTooltip.style.left = `${cellRect.left - containerRect.left + cellRect.width / 2}px`;
    tooltipTimer = setTimeout(dismissTooltip, 3000);
    setTimeout(() => document.addEventListener('click', handleOutsideClick), 0);
  } catch {
  }
}

function isBeforeToday(year, month, day) {
  if (year !== todayYear)  return year < todayYear;
  if (month !== todayMonth) return month < todayMonth;
  return day < todayDay;
}

async function fetchBlockedDates(year, month) {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  try {
    const res = await fetch(`/api/reservations/blocked-dates?tenant_id=${encodeURIComponent(tenantConfig.id)}&month=${monthStr}`);
    if (!res.ok) { blockedDates = new Set(); return; }
    const data = await res.json();
    blockedDates = new Set(data.blocked_dates || []);
  } catch {
    blockedDates = new Set();
  }
}

async function renderCalendar(year, month) {
  await fetchBlockedDates(year, month);

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
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return past || blockedDates.has(dateStr);
    },
    isBlocked: (y, m, d) => {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return blockedDates.has(dateStr);
    },
    onSelect: (y, m, d) => selectDay(y, m, d),
    onBlockedSelect: (y, m, d, cell) => showBlockedTooltip(cell),
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
