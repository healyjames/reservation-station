import { tenantConfig } from './tenants.js';

// Booking form state
let formState = {
  step: 1,
  selectedDate: null,
  blockedTimes: [],
  formData: {
    guests: 2,
    time: '',
    firstName: '',
    surname: '',
    email: '',
    telephone: '',
    dietary: ''
  }
};

// Time slots: 12:00 to 21:30 in 30-minute intervals
const TIME_SLOTS = [];
for (let hour = 12; hour <= 21; hour++) {
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
  if (hour < 21 || hour === 21) {
    TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
  }
}

// Format date as YYYY-MM-DD
function formatDateForAPI(date) {
  const year = date.year;
  const month = (date.month + 1).toString().padStart(2, '0');
  const day = date.day.toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date for display
function formatDateForDisplay(date) {
  return new Date(date.year, date.month, date.day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Fetch blocked times for a given date and guest count
async function fetchBlockedTimes(date, guests) {
  const tenantId = tenantConfig?.id;
  if (!tenantId) return [];
  try {
    const dateStr = formatDateForAPI(date);
    const res = await fetch(`/api/reservations/blocked-times?tenant_id=${tenantId}&date=${dateStr}&guests=${guests}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.blocked_times ?? [];
  } catch {
    return [];
  }
}

// Validate step 1 (guests and time)
function validateStep1() {
  const maxGuests = tenantConfig?.max_guests ?? 20;
  return formState.formData.guests >= 2 &&
         formState.formData.guests <= maxGuests &&
         formState.formData.time !== '';
}

// Validate step 2 (required fields non-empty — format is enforced by HTML5)
function validateStep2() {
  const { firstName, surname, email, telephone } = formState.formData;
  return (
    firstName.trim().length > 0 &&
    surname.trim().length > 0 &&
    email.trim().length > 0 &&
    telephone.trim().length > 0
  );
}

// Render step 1: Booking details
function renderStep1(container) {
  const dateDisplay = formatDateForDisplay(formState.selectedDate);
  const availableSlots = TIME_SLOTS.filter(slot => !formState.blockedTimes.includes(slot));

  const timeSelectHTML = availableSlots.length > 0
    ? `<select id="time" name="time" required>
        <option value="">Select a time</option>
        ${availableSlots.map(slot => `
          <option value="${slot}" ${formState.formData.time === slot ? 'selected' : ''}>
            ${slot}
          </option>
        `).join('')}
      </select>`
    : `<p class="no-availability" style="color: var(--primary-lighter); margin: 0;">No times available for this date with ${formState.formData.guests} guests. Try a different date or fewer guests.</p>`;

  container.innerHTML = `
    <div class="booking-form-content">
      <div class="booking-header">
        <h2>Book Your Table</h2>
        <div class="calendar-nav">
          <div class="step-indicator">Step 1 of 2</div>
          <button type="button" class="calendar-nav-btn" disabled aria-label="Previous step">
            &#8592;
          </button>
          <button type="button" class="calendar-nav-btn" id="next-step-btn" aria-label="Next step" ${validateStep1() ? '' : 'disabled'}>
            &#8594;
          </button>
        </div>
      </div>

      <div class="selected-date-info">
        <div class="date-label">Selected Date</div>
        <div class="date-value">${dateDisplay}</div>
        <button type="button" class="change-date-btn" id="change-date-btn">Change date</button>
      </div>

      <form id="booking-form-step1">
        <div class="form-group">
          <label for="guests">Number of Guests</label>
          <select id="guests" name="guests" required>
            ${Array.from(
              { length: (tenantConfig?.max_guests ?? 20) - 1 },
              (_, i) => i + 2
            ).map(n => `
              <option value="${n}" ${formState.formData.guests === n ? 'selected' : ''}>${n}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="time">Dining Time</label>
          ${timeSelectHTML}
        </div>

        <button type="button" class="button-secondary full-width" id="next-step-btn-footer" ${validateStep1() ? '' : 'disabled'}>
          Next &rarr;
        </button>
      </form>
    </div>
  `;

  // Attach event listeners
  const guestsInput = container.querySelector('#guests');
  const timeSelect = container.querySelector('#time');
  const nextBtn = container.querySelector('#next-step-btn');
  const nextBtnFooter = container.querySelector('#next-step-btn-footer');
  const changeDateBtn = container.querySelector('#change-date-btn');

  function advanceToStep2() {
    if (validateStep1()) {
      formState.step = 2;
      renderCurrentStep();
    }
  }

  function updateNextButton() {
    const valid = validateStep1();
    nextBtn.disabled = !valid;
    nextBtnFooter.disabled = !valid;
  }

  guestsInput.addEventListener('change', async (e) => {
    formState.formData.guests = parseInt(e.target.value) || 1;
    formState.blockedTimes = await fetchBlockedTimes(formState.selectedDate, formState.formData.guests);
    if (formState.blockedTimes.includes(formState.formData.time)) {
      formState.formData.time = '';
    }

    // Update only the time dropdown to avoid re-rendering the whole step
    const timeFormGroup = container.querySelector('#time')?.closest('.form-group')
      ?? container.querySelectorAll('.form-group')[1];
    const availableSlots = TIME_SLOTS.filter(slot => !formState.blockedTimes.includes(slot));
    timeFormGroup.innerHTML = `
      <label for="time">Dining Time</label>
      ${availableSlots.length > 0
        ? `<select id="time" name="time" required>
            <option value="">Select a time</option>
            ${availableSlots.map(slot => `
              <option value="${slot}" ${formState.formData.time === slot ? 'selected' : ''}>${slot}</option>
            `).join('')}
          </select>`
        : `<p class="no-availability" style="color: var(--primary-lighter); margin: 0;">No times available for this date with ${formState.formData.guests} guests. Try a different date or fewer guests.</p>`
      }
    `;

    const newTimeSelect = timeFormGroup.querySelector('#time');
    if (newTimeSelect) {
      newTimeSelect.addEventListener('change', (ev) => {
        formState.formData.time = ev.target.value;
        updateNextButton();
      });
    }
    updateNextButton();
  });

  if (timeSelect) {
    timeSelect.addEventListener('change', (e) => {
      formState.formData.time = e.target.value;
      updateNextButton();
    });
  }

  nextBtn.addEventListener('click', advanceToStep2);
  nextBtnFooter.addEventListener('click', advanceToStep2);

  changeDateBtn.addEventListener('click', () => {
    hideBookingForm();
  });
}

// Render step 2: Personal details
function renderStep2(container) {
  container.innerHTML = `
    <div class="booking-form-content">
      <div class="booking-header">
        <h2>Your Details</h2>
        <div class="calendar-nav">
          <div class="step-indicator">Step 2 of 2</div>
          <button type="button" class="calendar-nav-btn" id="prev-step-btn" aria-label="Previous step">
            &#8592;
          </button>
        </div>
      </div>

      <form id="booking-form-step2">
        <div class="form-group">
          <label for="firstName">First Name *</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            maxlength="50"
            value="${formState.formData.firstName}"
            autocomplete="given-name"
            required
          />
          <span class="field-error">This field is required</span>
        </div>

        <div class="form-group">
          <label for="surname">Surname *</label>
          <input
            type="text"
            id="surname"
            name="surname"
            maxlength="50"
            value="${formState.formData.surname}"
            autocomplete="family-name"
            required
          />
          <span class="field-error">This field is required</span>
        </div>

        <div class="form-group">
          <label for="email">Email *</label>
          <input
            type="email"
            id="email"
            name="email"
            value="${formState.formData.email}"
            autocomplete="email"
            required
          />
          <span class="field-error">Please enter a valid email address</span>
        </div>

        <div class="form-group">
          <label for="telephone">Phone Number *</label>
          <input
            type="tel"
            id="telephone"
            name="telephone"
            value="${formState.formData.telephone}"
            autocomplete="tel"
            placeholder="+44 7700 900000"
            pattern="\+?[\d\s\-]{7,15}"
            title="Please enter a valid phone number (7–15 digits, e.g. +44 7700 900000)"
            required
          />
          <span class="field-error">Please enter a valid phone number (e.g. +44 7700 900000)</span>
        </div>

        <div class="form-group full-width">
          <label for="dietary">Dietary Requirements (Optional)</label>
          <textarea
            id="dietary"
            name="dietary"
            rows="3"
            maxlength="500"
            placeholder="Let us know about any allergies or dietary preferences..."
          >${formState.formData.dietary}</textarea>
        </div>

        <div id="error-container" class="error-container full-width" style="display: none;"></div>

        <button type="submit" class="button-secondary full-width" id="book-now-btn" ${validateStep2() ? '' : 'disabled'}>
          Book Now
        </button>
      </form>
    </div>
  `;

  // DOM refs
  const form            = container.querySelector('#booking-form-step2');
  const firstNameInput  = container.querySelector('#firstName');
  const surnameInput    = container.querySelector('#surname');
  const emailInput      = container.querySelector('#email');
  const telephoneInput  = container.querySelector('#telephone');
  const dietaryTextarea = container.querySelector('#dietary');
  const bookNowBtn      = container.querySelector('#book-now-btn');
  const prevBtn         = container.querySelector('#prev-step-btn');
  const errorContainer  = container.querySelector('#error-container');

  function runAllValidations() {
    bookNowBtn.disabled = !form.checkValidity();
  }

  firstNameInput.addEventListener('input',  (e) => { formState.formData.firstName  = e.target.value; runAllValidations(); });
  surnameInput.addEventListener('input',    (e) => { formState.formData.surname    = e.target.value; runAllValidations(); });
  emailInput.addEventListener('input',      (e) => { formState.formData.email      = e.target.value; runAllValidations(); });
  telephoneInput.addEventListener('input',  (e) => { formState.formData.telephone  = e.target.value; runAllValidations(); });

  dietaryTextarea.addEventListener('input', (e) => { formState.formData.dietary = e.target.value; });

  prevBtn.addEventListener('click', () => {
    formState.step = 1;
    renderCurrentStep();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return;

    const tenantId = tenantConfig?.id;
    if (!tenantId) {
      showError(errorContainer, 'Configuration error: Missing tenant ID. Please contact support.');
      return;
    }

    bookNowBtn.disabled = true;
    bookNowBtn.textContent = 'Booking...';

    try {
      const requestBody = {
        tenant_id: tenantId,
        first_name: formState.formData.firstName.trim(),
        surname: formState.formData.surname.trim(),
        telephone: formState.formData.telephone.trim(),
        email: formState.formData.email.trim(),
        reservation_date: formatDateForAPI(formState.selectedDate),
        reservation_time: formState.formData.time,
        guests: formState.formData.guests,
        dietary_requirements: formState.formData.dietary.trim() || undefined
      };

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        showSuccess();
      } else {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || 'Failed to create reservation. Please try again.';
        showError(errorContainer, errorMessage);
        bookNowBtn.disabled = false;
        bookNowBtn.textContent = 'Book Now';
      }
    } catch (error) {
      showError(errorContainer, 'Network error. Please check your connection and try again.');
      bookNowBtn.disabled = false;
      bookNowBtn.textContent = 'Book Now';
    }
  });
}

// Show error message
function showError(container, message) {
  container.style.display = 'block';
  container.innerHTML = `
    <div class="message error-message">
      <div class="message-header error-header">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h4>Error</h4>
      </div>
      <p>${message}</p>
    </div>
  `;
}

// Show success message
function showSuccess() {
  const container = document.getElementById('booking-container');
  const dateDisplay = formatDateForDisplay(formState.selectedDate);

  container.innerHTML = `
    <div class="booking-form-content">
      <div class="message success-message">
        <div class="message-header success-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <h4>Booking Confirmed!</h4>
        </div>
        <p>Your reservation for ${formState.formData.guests} guest${formState.formData.guests > 1 ? 's' : ''} on ${dateDisplay} at ${formState.formData.time} has been confirmed.</p>
        <p>We've sent a confirmation email to ${formState.formData.email}.</p>
      </div>
      <button type="button" class="button-secondary" id="new-booking-btn">
        Make Another Booking
      </button>
    </div>
  `;

  const newBookingBtn = container.querySelector('#new-booking-btn');
  newBookingBtn.addEventListener('click', () => {
    resetForm();
    hideBookingForm();
  });
}

// Reset form state
function resetForm() {
  formState = {
    step: 1,
    selectedDate: null,
    blockedTimes: [],
    formData: {
      guests: 2,
      time: '',
      firstName: '',
      surname: '',
      email: '',
      telephone: '',
      dietary: ''
    }
  };
}

// Render current step
function renderCurrentStep() {
  const container = document.getElementById('booking-container');
  if (formState.step === 1) {
    renderStep1(container);
  } else {
    renderStep2(container);
  }
}

// Hide booking form and show calendar
function hideBookingForm() {
  const bookingContainer = document.getElementById('booking-container');
  const calendarContainer = document.getElementById('calendar-container');

  bookingContainer.hidden = true;
  calendarContainer.hidden = false;
}

// Show booking form (called from calendar.js)
export async function showBookingForm(selectedDate) {
  const bookingContainer = document.getElementById('booking-container');
  const calendarContainer = document.getElementById('calendar-container');

  if (!tenantConfig) {
    bookingContainer.innerHTML = `
      <div class="booking-form-content">
        <div class="error-container" style="display: block;">
          Unable to load booking configuration. Please check the URL and try again.
        </div>
      </div>
    `;
    bookingContainer.removeAttribute('hidden');
    calendarContainer.hidden = true;
    return;
  }

  formState.selectedDate = selectedDate;
  formState.step = 1;
  formState.blockedTimes = await fetchBlockedTimes(selectedDate, formState.formData.guests);

  calendarContainer.hidden = true;
  bookingContainer.removeAttribute('hidden');

  renderCurrentStep();
}
