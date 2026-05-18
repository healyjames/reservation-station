(function () {
  let currentDate = todayString();
  let currentReservations = [];
  let tenantInfo = null;

  function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function offsetDate(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function apiFetch(path, options = {}) {
    const { headers: extraHeaders, ...restOptions } = options;
    const res = await fetch(path, {
      headers: { 'Authorization': `Bearer ${AdminAuth.getToken()}`, ...extraHeaders },
      ...restOptions,
    });
    if (res.status === 401) {
      AdminAuth.logout();
      return null;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function loadTenant() {
    try {
      tenantInfo = await apiFetch('/api/admin/me');
      if (!tenantInfo) return;

      const nameEl = document.getElementById('venue-name');
      if (nameEl) nameEl.textContent = tenantInfo.name || 'Dashboard';
    } catch (err) {
      console.error('Failed to load tenant info:', err.message);
    }
  }

  function renderBlockToggle(date, isBlocked) {
    const container = document.getElementById('day-block-container');
    if (!container) return;

    container.innerHTML = `
      <div class="toggle-list">
				<div class="toggle-list-item">
					<div class="toggle-list-item-content">
						<p class="toggle-list-item-header"><strong>Block this day</strong></p>
						<p class="toggle-list-item-subtext">Customers will no longer be able to make reservations on this date. Existing reservations will not be affected.</p>
					</div>
					<div class="toggle-list-item-switch">
						<div class="form-group-check">
							<div class="toggle-switch">
								<input type="checkbox" id="day-block-toggle" role="switch" ${isBlocked ? 'checked' : ''} />
							</div>
						</div>
						<div id="day-block-feedback" class="alert" aria-live="polite" aria-hidden="true"></div>
					</div>
				</div>
      </div>
    `;

    container.querySelector('#day-block-toggle').addEventListener('change', async (e) => {
      const nowBlocked = e.target.checked;
      e.target.disabled = true;
      const feedbackEl = container.querySelector('#day-block-feedback');
      feedbackEl.className = 'alert';
      feedbackEl.setAttribute('aria-hidden', 'true');

      try {
        if (nowBlocked) {
          await apiFetch('/api/admin/blocked-dates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date }),
          });
        } else {
          await apiFetch(`/api/admin/blocked-dates/date/${date}`, { method: 'DELETE' });
        }
        feedbackEl.textContent = nowBlocked ? 'Day blocked.' : 'Day unblocked.';
        feedbackEl.classList.add('alert-success', 'visible');
        feedbackEl.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
          feedbackEl.classList.remove('visible');
          feedbackEl.setAttribute('aria-hidden', 'true');
        }, 3000);
      } catch (err) {
        e.target.checked = !nowBlocked;
        feedbackEl.textContent = err.message || 'Failed to update block state.';
        feedbackEl.classList.add('alert-error', 'visible');
        feedbackEl.setAttribute('aria-hidden', 'false');
      } finally {
        e.target.disabled = false;
      }
    });
  }

  async function loadBlockState(date) {
    try {
      const blocks = await apiFetch(`/api/admin/blocked-dates?date=${date}`);
      if (blocks === null) return;
      renderBlockToggle(date, blocks.some(b => b.start_time === null));
    } catch {
      renderBlockToggle(date, false);
    }
  }

  async function loadBookings(date) {
    const listEl = document.getElementById('bookings-list');
    listEl.setAttribute('aria-busy', 'true');
    listEl.innerHTML = '<p class="loading-text">Loading…</p>';

    const [y, m, d] = date.split('-').map(Number);
    const displayDate = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
    const todayLabel = date === todayString() ? ' <span class="today-label">today</span>' : '';
    document.getElementById('current-date-display').innerHTML = displayDate + todayLabel;

    try {
      const reservations = await apiFetch(`/api/admin/reservations?date=${date}`);
      if (!reservations) return;

      currentReservations = reservations;
      updateDaySummary(reservations);
      renderBookingList(reservations);
      loadBlockState(date);
    } catch (err) {
      listEl.innerHTML = `<p class="error-text">Failed to load bookings: ${escHtml(err.message)}</p>`;
    } finally {
      listEl.setAttribute('aria-busy', 'false');
    }
  }

  function updateDaySummary(reservations) {
    const totalGuests = reservations.reduce((sum, r) => sum + (r.guests || 0), 0);
    document.getElementById('summary-text').textContent = `${totalGuests} cover${totalGuests !== 1 ? 's' : ''}`;
  }

  function renderBookingList(reservations) {
    const listEl = document.getElementById('bookings-list');

    if (!reservations.length) {
      listEl.innerHTML = '<p class="empty-state">No bookings for this date.</p>';
      return;
    }

    listEl.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'booking-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Name</th>
          <th scope="col">Guests</th>
          <th scope="col">Dietary requirements</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    reservations.forEach(r => tbody.appendChild(renderBookingRow(r)));
    listEl.appendChild(table);

    const cards = document.createElement('div');
    cards.className = 'booking-cards';
    reservations.forEach(r => cards.appendChild(renderBookingCard(r)));
    listEl.appendChild(cards);
  }

  function renderBookingRow(r) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(r.reservation_time)}</td>
      <td>${escHtml(r.first_name)} ${escHtml(r.surname)}</td>
      <td>${r.guests}</td>
      <td>${escHtml(r.dietary_requirements || '-')}</td>
      <td class="actions-cell">
        <button class="btn-action btn-edit" aria-label="Edit booking for ${escHtml(r.first_name)} ${escHtml(r.surname)}">Edit</button>
        <button class="btn-action btn-delete" aria-label="Delete booking for ${escHtml(r.first_name)} ${escHtml(r.surname)}">Delete</button>
      </td>
    `;
    tr.querySelector('.btn-edit').addEventListener('click', () => {
      BookingModal.openEdit(r, () => loadBookings(currentDate));
    });
    tr.querySelector('.btn-delete').addEventListener('click', () => {
      BookingModal.openDelete(r, () => loadBookings(currentDate));
    });
    return tr;
  }

  function renderBookingCard(r) {
    const card = document.createElement('div');
    card.className = 'booking-card';
    card.innerHTML = `
      <div class="card-time-guests">
        <span class="card-time">${escHtml(r.reservation_time)}</span>
        <span class="card-guests"><strong>${r.guests}</strong> guest${r.guests !== 1 ? 's' : ''}</span>
      </div>
      <div class="card-name">${escHtml(r.first_name)} ${escHtml(r.surname)}</div>
      ${r.dietary_requirements ? `<div class="card-dietary">${escHtml(r.dietary_requirements)}</div>` : ''}
      <div class="card-actions">
        <button class="btn-action btn-edit" aria-label="Edit booking for ${escHtml(r.first_name)} ${escHtml(r.surname)}">Edit</button>
        <button class="btn-action btn-delete" aria-label="Delete booking for ${escHtml(r.first_name)} ${escHtml(r.surname)}">Delete</button>
      </div>
    `;
    card.querySelector('.btn-edit').addEventListener('click', () => {
      BookingModal.openEdit(r, () => loadBookings(currentDate));
    });
    card.querySelector('.btn-delete').addEventListener('click', () => {
      BookingModal.openDelete(r, () => loadBookings(currentDate));
    });
    return card;
  }

  async function init() {
    AdminAuth.requireAuth();

    const cached = AdminAuth.getTenant();
    if (cached && cached.name) {
      const nameEl = document.getElementById('venue-name');
      if (nameEl) nameEl.textContent = cached.name;
    }

    document.getElementById('logout-btn').addEventListener('click', () => AdminAuth.logout());

    document.getElementById('prev-day').addEventListener('click', () => {
      currentDate = offsetDate(currentDate, -1);
      loadBookings(currentDate);
    });

    document.getElementById('next-day').addEventListener('click', () => {
      currentDate = offsetDate(currentDate, 1);
      loadBookings(currentDate);
    });

    DatePicker.init(
      document.getElementById('current-date-display'),
      (dateStr) => {
        currentDate = dateStr;
        loadBookings(currentDate);
      }
    );

    await loadTenant();
    await loadBookings(currentDate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
