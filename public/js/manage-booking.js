import { renderCalendarGrid, MONTHS } from './calendar-core.js';

const container = document.getElementById('cancel-app');

const state = {
  view: 'loading',
  reservation: null,
  tenantConfig: null,
  editData: null,
  calYear: null,
  calMonth: null,
  selectedDate: null,
  selectedTime: '',
  blockedDates: new Set(),
  blockedTimes: [],
  errorMessage: '',
};

const _today = new Date();
const todayYear  = _today.getFullYear();
const todayMonth = _today.getMonth();
const todayDay   = _today.getDate();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown date';
  return new Date(`${dateString}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getFullName(reservation) {
  return [reservation.first_name, reservation.surname].filter(Boolean).join(' ').trim() || 'Guest';
}

function getGuestsLabel(guests) {
  return `${guests} guest${guests === 1 ? '' : 's'}`;
}

function formatDateForAPI(date) {
  return `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function formatDateForDisplay(date) {
  return new Date(date.year, date.month, date.day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function generateSlots(openTime, closeTime) {
  const slots = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  for (let mins = openMins; mins < closeMins; mins += 30) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

function getSlotsForDate(date, tenantConfig) {
  const hours = tenantConfig?.opening_hours;
  if (!hours || hours.length === 0) return generateSlots('12:00', '22:00');
  const dow = new Date(`${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}T12:00:00Z`).getUTCDay();
  const entry = hours.find(h => Number(h.day_of_week) === dow);
  if (!entry || entry.is_closed) return [];
  if (!entry.open_time || !entry.close_time) return generateSlots('12:00', '22:00');
  return generateSlots(entry.open_time, entry.close_time);
}

function isToday(date) {
  const now = new Date();
  return date.year === now.getFullYear() && date.month === now.getMonth() && date.day === now.getDate();
}

function getEarliestTodaySlot() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const thresholdMinutes = Math.ceil((currentMinutes + 30) / 30) * 30;
  const h = Math.floor(thresholdMinutes / 60);
  const m = thresholdMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function isSameDate(a, b) {
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function getAvailableSlots(date, blockedTimes, tenantConfig) {
  let slots = getSlotsForDate(date, tenantConfig).filter(slot => !blockedTimes.includes(slot));
  if (isToday(date)) {
    const earliest = getEarliestTodaySlot();
    slots = slots.filter(slot => slot >= earliest);
  }
  return slots;
}

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

function showBlockedTooltip(calContainer, cell) {
  try {
    dismissTooltip();
    activeTooltip = document.createElement('div');
    activeTooltip.className = 'calendar-blocked-tooltip';
    activeTooltip.setAttribute('role', 'tooltip');
    activeTooltip.setAttribute('aria-live', 'polite');
    activeTooltip.textContent = 'Bookings currently unavailable for this date';
    calContainer.appendChild(activeTooltip);
    const cellRect      = cell.getBoundingClientRect();
    const containerRect = calContainer.getBoundingClientRect();
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

function isDateUnavailable(year, month, day) {
  if (isBeforeToday(year, month, day)) return true;
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (state.blockedDates.has(dateStr)) return true;
  const hours = state.tenantConfig?.opening_hours;
  if (hours && hours.length > 0) {
    const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
    const entry = hours.find(h => Number(h.day_of_week) === dow);
    if (!entry || entry.is_closed) return true;
  }
  return false;
}

function isDateBlocked(year, month, day) {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return state.blockedDates.has(dateStr);
}

async function fetchBlockedDatesForMonth(year, month) {
  const tenantId = state.tenantConfig?.id;
  if (!tenantId) { state.blockedDates = new Set(); return; }
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  try {
    const res = await fetch(`/api/reservations/blocked-dates?tenant_id=${encodeURIComponent(tenantId)}&month=${monthStr}`);
    if (!res.ok) { state.blockedDates = new Set(); return; }
    const data = await res.json();
    state.blockedDates = new Set(data.blocked_dates || []);
  } catch {
    state.blockedDates = new Set();
  }
}

async function fetchBlockedTimesForDate(date, guests) {
  const tenantId = state.tenantConfig?.id;
  if (!tenantId) return [];
  try {
    const dateStr = formatDateForAPI(date);
    const res = await fetch(`/api/reservations/blocked-times?tenant_id=${encodeURIComponent(tenantId)}&date=${dateStr}&guests=${guests}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.blocked_times ?? [];
  } catch {
    return [];
  }
}

function inlineErrorHtml(message) {
  if (!message) return '';
  return `
    <div class="message error-message">
      <div class="message-header error-header">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h2>Something went wrong</h2>
      </div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function detailsHtml(reservation) {
  const dietary = reservation.dietary_requirements?.trim();
  return `
    <div class="details-list" role="list" aria-label="Booking details">
      <div class="detail-row" role="listitem">
        <div class="detail-term">Name</div>
        <p class="detail-value">${escapeHtml(getFullName(reservation))}</p>
      </div>
      <div class="detail-row" role="listitem">
        <div class="detail-term">Date</div>
        <p class="detail-value">${escapeHtml(formatDate(reservation.reservation_date))}</p>
      </div>
      <div class="detail-row" role="listitem">
        <div class="detail-term">Time</div>
        <p class="detail-value">${escapeHtml(reservation.reservation_time || 'Unknown time')}</p>
      </div>
      <div class="detail-row" role="listitem">
        <div class="detail-term">Party size</div>
        <p class="detail-value">${escapeHtml(getGuestsLabel(Number(reservation.guests) || 0))}</p>
      </div>
      ${dietary ? `
        <div class="detail-row" role="listitem">
          <div class="detail-term">Dietary requirements</div>
          <p class="detail-value">${escapeHtml(dietary)}</p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderLoading() {
  container.innerHTML = `
    <section class="stack" aria-busy="true">
      <h1 class="page-title">Manage your booking</h1>
      <div class="loading-indicator">
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading your booking details...</p>
      </div>
    </section>
  `;
}

function renderError(message) {
  container.innerHTML = `
    <section class="stack">
      <div class="message error-message">
        <div class="message-header error-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h2>Unable to load booking</h2>
        </div>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `;
}

function renderOverview() {
  container.innerHTML = `
    <section class="stack">
      <div>
        <h1 class="page-title">Manage your booking</h1>
        <p class="page-subtitle">View, edit, or cancel your reservation.</p>
      </div>
      ${inlineErrorHtml(state.errorMessage)}
      ${detailsHtml(state.reservation)}
      <div class="action-group">
        <button type="button" id="edit-details-btn" class="button-secondary">Edit Details</button>
        <button type="button" id="change-datetime-btn" class="button-secondary">Change Date &amp; Time</button>
      </div>
      <button type="button" id="cancel-booking-btn" class="button-danger">Cancel Booking</button>
    </section>
  `;

  container.querySelector('#edit-details-btn').addEventListener('click', () => {
    state.errorMessage = '';
    state.editData = {
      first_name: state.reservation.first_name || '',
      surname: state.reservation.surname || '',
      telephone: state.reservation.telephone || '',
      email: state.reservation.email || '',
      dietary_requirements: state.reservation.dietary_requirements || '',
      guests: Number(state.reservation.guests) || 2,
    };
    renderEditDetails();
  });

  container.querySelector('#change-datetime-btn').addEventListener('click', () => {
    state.errorMessage = '';
    const [resYear, resMonth, resDay] = state.reservation.reservation_date.split('-').map(Number);
    state.calYear    = resYear;
    state.calMonth   = resMonth - 1;
    state.selectedDate = { year: resYear, month: resMonth - 1, day: resDay };
    state.selectedTime = state.reservation.reservation_time || '';
    state.blockedDates = new Set();
    state.blockedTimes = [];
    renderChangeDatetime();
  });

  container.querySelector('#cancel-booking-btn').addEventListener('click', () => {
    state.errorMessage = '';
    renderCancelConfirm();
  });
}

function renderEditDetails() {
  const d = state.editData;
  const maxGuests = state.tenantConfig?.max_guests || 20;

  container.innerHTML = `
    <section class="stack">
      <div>
        <h1 class="page-title">Edit Details</h1>
        <p class="page-subtitle">Update your contact information and guest count.</p>
      </div>
      ${inlineErrorHtml(state.errorMessage)}
      <form id="edit-form" novalidate>
        <div class="stack">
          <div class="form-group">
            <label for="edit-first-name">First Name *</label>
            <input type="text" id="edit-first-name" name="first_name" maxlength="50" value="${escapeHtml(d.first_name)}" autocomplete="given-name" required />
            <span class="field-error">This field is required</span>
          </div>
          <div class="form-group">
            <label for="edit-surname">Surname *</label>
            <input type="text" id="edit-surname" name="surname" maxlength="50" value="${escapeHtml(d.surname)}" autocomplete="family-name" required />
            <span class="field-error">This field is required</span>
          </div>
          <div class="form-group">
            <label for="edit-telephone">Phone Number *</label>
            <input type="tel" id="edit-telephone" name="telephone" value="${escapeHtml(d.telephone)}" autocomplete="tel" placeholder="+44 7700 900000" pattern="\\+?[\\d\\s\\-]{7,15}" title="Please enter a valid phone number (7–15 digits)" required />
            <span class="field-error">Please enter a valid phone number (e.g. +44 7700 900000)</span>
          </div>
          <div class="form-group">
            <label for="edit-email">Email *</label>
            <input type="email" id="edit-email" name="email" value="${escapeHtml(d.email)}" autocomplete="email" required />
            <span class="field-error">Please enter a valid email address</span>
          </div>
          <div class="form-group">
            <label for="edit-dietary">Dietary Requirements (Optional)</label>
            <textarea id="edit-dietary" name="dietary_requirements" rows="3" maxlength="500" placeholder="Let us know about any allergies or dietary preferences...">${escapeHtml(d.dietary_requirements)}</textarea>
          </div>
          <div class="form-group">
            <label for="edit-guests">Number of Guests</label>
            <select id="edit-guests" name="guests" required>
              ${Array.from({ length: maxGuests - 1 }, (_, i) => i + 2).map(n => `
                <option value="${n}" ${d.guests === n ? 'selected' : ''}>${n}</option>
              `).join('')}
            </select>
          </div>
          <div class="action-group">
            <button type="button" id="back-btn" class="button-secondary">&#8592; Back</button>
            <button type="submit" id="save-btn" class="button-secondary">Save Changes</button>
          </div>
        </div>
      </form>
    </section>
  `;

  const form    = container.querySelector('#edit-form');
  const saveBtn = container.querySelector('#save-btn');

  container.querySelector('#back-btn').addEventListener('click', () => {
    state.errorMessage = '';
    renderOverview();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const rawDietary = form.elements['dietary_requirements'].value.trim();
    state.editData = {
      first_name: form.elements['first_name'].value.trim(),
      surname: form.elements['surname'].value.trim(),
      telephone: form.elements['telephone'].value.trim(),
      email: form.elements['email'].value.trim(),
      dietary_requirements: rawDietary,
      guests: parseInt(form.elements['guests'].value, 10),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    state.errorMessage = '';

    const ok = await patchReservation(state.reservation.id, { ...state.editData });
    if (ok) {
      Object.assign(state.reservation, state.editData);
      renderSuccessEdit();
    } else {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
      renderEditDetails();
    }
  });
}

async function renderChangeDatetime() {
  const onCurrentMonth = state.calYear === todayYear && state.calMonth === todayMonth;

  container.innerHTML = `
    <section class="stack">
      <div>
        <h1 class="page-title">Change Date &amp; Time</h1>
        <p class="page-subtitle">Choose a new date and time for your reservation.</p>
      </div>
      ${inlineErrorHtml(state.errorMessage)}
      <div class="calendar-shell">
        <div class="calendar-container" id="mb-cal-container">
          <div class="calendar-header">
            <h2 id="mb-cal-title">${MONTHS[state.calMonth]} ${state.calYear}</h2>
            <div class="calendar-nav">
              <button type="button" class="calendar-nav-btn" id="mb-prev-month" aria-label="Previous month" ${onCurrentMonth ? 'disabled' : ''}>&#8592;</button>
              <button type="button" class="calendar-nav-btn" id="mb-next-month" aria-label="Next month">&#8594;</button>
            </div>
          </div>
          <div class="calendar-grid" id="mb-cal-grid"></div>
        </div>
      </div>
      <div id="mb-time-section"></div>
      <div class="action-group">
        <button type="button" id="back-btn" class="button-secondary">&#8592; Back</button>
        <button type="button" id="save-datetime-btn" class="button-secondary" disabled>Save Changes</button>
      </div>
    </section>
  `;

  const calContainer = container.querySelector('#mb-cal-container');
  const calTitle     = container.querySelector('#mb-cal-title');
  const calGrid      = container.querySelector('#mb-cal-grid');
  const prevBtn      = container.querySelector('#mb-prev-month');
  const nextBtn      = container.querySelector('#mb-next-month');
  const timeSection  = container.querySelector('#mb-time-section');
  const saveBtn      = container.querySelector('#save-datetime-btn');

  function updateSaveBtn() {
    saveBtn.disabled = !(state.selectedDate && state.selectedTime);
  }

  function renderTimeSlots() {
    if (!state.selectedDate) {
      timeSection.innerHTML = '';
      return;
    }

    const dateDisplay = formatDateForDisplay(state.selectedDate);
    const available   = getAvailableSlots(state.selectedDate, state.blockedTimes, state.tenantConfig);

    if (state.selectedTime && !available.includes(state.selectedTime)) {
      state.selectedTime = '';
    }

    const slotsHtml = available.length > 0
      ? `<select id="mb-time-select">
          <option value="">Select a time</option>
          ${available.map(slot => `<option value="${slot}" ${state.selectedTime === slot ? 'selected' : ''}>${slot}</option>`).join('')}
        </select>`
      : `<p class="inline-helper inline-helper-error">No times available for this date. Please try a different date.</p>`;

    timeSection.innerHTML = `
      <div class="selected-date-info">
        <div class="date-label">Selected Date</div>
        <div class="date-value">${escapeHtml(dateDisplay)}</div>
      </div>
      <div class="form-group">
        <label for="mb-time-select">Time</label>
        ${slotsHtml}
      </div>
    `;

    const timeSelect = timeSection.querySelector('#mb-time-select');
    if (timeSelect) {
      timeSelect.addEventListener('change', (e) => {
        state.selectedTime = e.target.value;
        updateSaveBtn();
      });
    }

    updateSaveBtn();
  }

  function paintCalendarGrid() {
    renderCalendarGrid(calGrid, state.calYear, state.calMonth, {
      selectedDate: state.selectedDate,
      isDisabled: (y, m, d) => isDateUnavailable(y, m, d),
      isBlocked:  (y, m, d) => isDateBlocked(y, m, d),
      onSelect:        (y, m, d)       => selectDate(y, m, d),
      onBlockedSelect: (y, m, d, cell) => showBlockedTooltip(calContainer, cell),
      cellClass:   'calendar-day',
      headerClass: 'day-name',
    });
  }

  function selectDate(year, month, day) {
    state.selectedDate = { year, month, day };
    state.selectedTime = '';
    state.blockedTimes = [];
    paintCalendarGrid();

    const available   = getAvailableSlots(state.selectedDate, state.blockedTimes, state.tenantConfig);
    const currentTime = state.reservation.reservation_time;
    if (currentTime && available.includes(currentTime)) {
      state.selectedTime = currentTime;
    }

    renderTimeSlots();
  }

  async function refreshCalendar() {
    await fetchBlockedDatesForMonth(state.calYear, state.calMonth);
    const onCurrent = state.calYear === todayYear && state.calMonth === todayMonth;
    calTitle.textContent = `${MONTHS[state.calMonth]} ${state.calYear}`;
    prevBtn.disabled = onCurrent;
    paintCalendarGrid();
  }

  prevBtn.addEventListener('click', () => {
    if (state.calYear === todayYear && state.calMonth === todayMonth) return;
    state.calMonth -= 1;
    if (state.calMonth < 0) { state.calMonth = 11; state.calYear -= 1; }
    refreshCalendar();
  });

  nextBtn.addEventListener('click', () => {
    state.calMonth += 1;
    if (state.calMonth > 11) { state.calMonth = 0; state.calYear += 1; }
    refreshCalendar();
  });

  container.querySelector('#back-btn').addEventListener('click', () => {
    state.errorMessage = '';
    dismissTooltip();
    renderOverview();
  });

  saveBtn.addEventListener('click', async () => {
    if (!state.selectedDate || !state.selectedTime) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    state.errorMessage = '';

    const patchData = {
      reservation_date: formatDateForAPI(state.selectedDate),
      reservation_time: state.selectedTime,
    };

    const ok = await patchReservation(state.reservation.id, patchData);
    if (ok) {
      state.reservation.reservation_date = patchData.reservation_date;
      state.reservation.reservation_time = patchData.reservation_time;
      renderSuccessEdit();
    } else {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
      renderChangeDatetime();
    }
  });

  // Mirror booking-form.js: await all data before rendering the time select
  await refreshCalendar();

  if (state.selectedDate) {
    const guests = Number(state.reservation.guests) || 2;
    state.blockedTimes = await fetchBlockedTimesForDate(state.selectedDate, guests);
    const available   = getAvailableSlots(state.selectedDate, state.blockedTimes, state.tenantConfig);
    const currentTime = state.reservation.reservation_time;
    if (!state.selectedTime && currentTime && available.includes(currentTime)) {
      state.selectedTime = currentTime;
    }
    renderTimeSlots();
    updateSaveBtn();
  }
}

function renderCancelConfirm() {
  container.innerHTML = `
    <section class="stack">
      <div>
        <h1 class="page-title">Cancel Booking</h1>
        <p class="page-subtitle">Are you sure you want to cancel this reservation?</p>
      </div>
      ${inlineErrorHtml(state.errorMessage)}
      ${detailsHtml(state.reservation)}
      <div class="action-group">
        <button type="button" id="keep-btn" class="button-secondary">Keep My Booking</button>
        <button type="button" id="confirm-cancel-btn" class="button-danger">Cancel My Booking</button>
      </div>
    </section>
  `;

  container.querySelector('#keep-btn').addEventListener('click', () => {
    state.errorMessage = '';
    renderOverview();
  });

  container.querySelector('#confirm-cancel-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#confirm-cancel-btn');
    btn.disabled = true;
    btn.textContent = 'Cancelling...';
    state.errorMessage = '';

    const ok = await deleteReservation(state.reservation.id);
    if (ok) {
      renderSuccessCancel();
    } else {
      renderCancelConfirm();
    }
  });
}

function renderSuccessEdit() {
  container.innerHTML = `
    <section class="stack">
      <div class="message success-message">
        <div class="message-header success-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <h2>Booking updated.</h2>
        </div>
        <p>
          <strong>${escapeHtml(getFullName(state.reservation))}</strong> &mdash;
          ${escapeHtml(formatDate(state.reservation.reservation_date))} at
          <strong>${escapeHtml(state.reservation.reservation_time || 'Unknown time')}</strong> &mdash;
          ${escapeHtml(getGuestsLabel(Number(state.reservation.guests) || 0))}
        </p>
      </div>
      <button type="button" id="back-to-overview-btn" class="button-secondary">Back to booking details</button>
    </section>
  `;

  container.querySelector('#back-to-overview-btn').addEventListener('click', () => {
    state.errorMessage = '';
    renderOverview();
  });
}

function renderSuccessCancel() {
  container.innerHTML = `
    <section class="stack">
      <div class="message success-message">
        <div class="message-header success-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <h2>Your booking has been cancelled.</h2>
        </div>
        <p><strong>${escapeHtml(getFullName(state.reservation))}</strong> on <strong>${escapeHtml(formatDate(state.reservation.reservation_date))}</strong> at <strong>${escapeHtml(state.reservation.reservation_time || 'Unknown time')}</strong> has been cancelled.</p>
      </div>
    </section>
  `;
}

async function loadReservation(id) {
  try {
    const res = await fetch(`/api/reservations/${encodeURIComponent(id)}`);
    if (res.status === 404) {
      renderError('Booking not found. It may have already been cancelled or the link is invalid.');
      return null;
    }
    if (!res.ok) {
      renderError('We could not load your booking right now. Please try again later.');
      return null;
    }
    return await res.json();
  } catch {
    renderError('We could not load your booking right now. Please try again later.');
    return null;
  }
}

async function loadTenant(tenantId) {
  try {
    const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function patchReservation(id, data) {
  try {
    const res = await fetch(`/api/reservations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) return true;
    state.errorMessage = res.status === 404
      ? 'Booking not found. It may have already been cancelled.'
      : 'We could not save your changes. Please try again later.';
    return false;
  } catch {
    state.errorMessage = 'We could not save your changes. Please try again later.';
    return false;
  }
}

async function deleteReservation(id) {
  try {
    const res = await fetch(`/api/reservations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) return true;
    state.errorMessage = res.status === 404
      ? 'Booking not found. It may have already been cancelled.'
      : 'We could not cancel your booking right now. Please try again later.';
    return false;
  } catch {
    state.errorMessage = 'We could not cancel your booking right now. Please try again later.';
    return false;
  }
}

async function init() {
  const reservationId = new URLSearchParams(window.location.search).get('id');
  if (!reservationId) {
    renderError('No booking reference found. Please check your link.');
    return;
  }

  renderLoading();

  const reservation = await loadReservation(reservationId);
  if (!reservation) return;

  const tenant = await loadTenant(reservation.tenant_id);

  state.reservation  = reservation;
  state.tenantConfig = tenant;
  renderOverview();
}

init();
