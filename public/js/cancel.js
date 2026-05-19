const container = document.getElementById('cancel-app');

const state = {
  reservation: null,
  errorMessage: ''
};

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
    timeZone: 'UTC'
  });
}

function getFullName(reservation) {
  return [reservation.first_name, reservation.surname].filter(Boolean).join(' ').trim() || 'Guest';
}

function getGuestsLabel(guests) {
  return `${guests} guest${guests === 1 ? '' : 's'}`;
}

function renderLoading() {
  container.innerHTML = `
    <section class="stack" aria-busy="true">
      <h1 class="page-title">Cancel your booking</h1>
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
          <h2>Unable to cancel booking</h2>
        </div>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `;
}

function renderReservation() {
  const reservation = state.reservation;
  const dietary = reservation.dietary_requirements?.trim();
  const inlineError = state.errorMessage
    ? `
        <div class="message error-message">
          <div class="message-header error-header">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2>Something went wrong</h2>
          </div>
          <p>${escapeHtml(state.errorMessage)}</p>
        </div>
      `
    : '';

  container.innerHTML = `
    <section class="stack">
      <div>
        <h1 class="page-title">Cancel your booking</h1>
        <p class="page-subtitle">Please review the booking below. If this is the one you want to cancel, use the button at the bottom of the page.</p>
      </div>
      ${inlineError}
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
      <button type="button" id="cancel-booking-btn" class="button-danger">Cancel My Booking</button>
    </section>
  `;

  container.querySelector('#cancel-booking-btn')?.addEventListener('click', handleCancel);
}

function renderSuccess() {
  const reservation = state.reservation;

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
        <p><strong>${escapeHtml(getFullName(reservation))}</strong> on <strong>${escapeHtml(formatDate(reservation.reservation_date))}</strong> at <strong>${escapeHtml(reservation.reservation_time || 'Unknown time')}</strong> has been cancelled.</p>
      </div>
    </section>
  `;
}

async function loadReservation() {
  const reservationId = new URLSearchParams(window.location.search).get('id');

  if (!reservationId) {
    renderError('No booking reference found. Please check your cancellation link.');
    return;
  }

  renderLoading();

  try {
    const response = await fetch(`/api/reservations/${encodeURIComponent(reservationId)}`);

    if (response.status === 404) {
      renderError('Booking not found. It may have already been cancelled.');
      return;
    }

    if (!response.ok) {
      renderError('We could not load your booking right now. Please try again later.');
      return;
    }

    state.reservation = await response.json();
    state.errorMessage = '';
    renderReservation();
  } catch {
    renderError('We could not load your booking right now. Please try again later.');
  }
}

async function handleCancel() {
  const button = container.querySelector('#cancel-booking-btn');
  if (!button || !state.reservation?.id) return;

  state.errorMessage = '';
  button.disabled = true;
  button.textContent = 'Cancelling...';

  try {
    const response = await fetch(`/api/reservations/${encodeURIComponent(state.reservation.id)}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      renderSuccess();
      return;
    }

    if (response.status === 404) {
      state.errorMessage = 'Booking not found. It may have already been cancelled.';
    } else {
      state.errorMessage = 'We could not cancel your booking right now. Please try again later.';
    }
  } catch {
    state.errorMessage = 'We could not cancel your booking right now. Please try again later.';
  }

  renderReservation();
}

loadReservation();
