const BookingModal = (() => {
  let dialog = null;
  let lastFocused = null;
  let _onSuccess = null;

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AdminAuth.getToken()}`,
    };
  }

  async function checkResponse(res) {
    if (res.status === 401) {
      AdminAuth.logout();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
  }

  function ensureDialog() {
    if (dialog) return;

    dialog = document.createElement('dialog');
    dialog.className = 'booking-modal';
    dialog.innerHTML = '<div class="modal-inner" id="modal-inner"></div>';
    document.body.appendChild(dialog);

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeModal();
    });

    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  function openModal() {
    ensureDialog();
    lastFocused = document.activeElement;
    dialog.showModal();
    const first = dialog.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  }

  function closeModal() {
    if (!dialog || !dialog.open) return;
    dialog.close();
    if (lastFocused) lastFocused.focus();
  }

  function showModalError(inner, message) {
    const el = inner.querySelector('#modal-error');
    if (!el) return;
    el.textContent = message;
    el.setAttribute('aria-hidden', 'false');
    el.classList.add('visible');
  }

  function openEdit(reservation, onSuccess) {
    _onSuccess = onSuccess;
    ensureDialog();

    const inner = dialog.querySelector('#modal-inner');
    inner.innerHTML = `
      <header class="modal-header">
        <h2>Edit Booking</h2>
        <button class="modal-close" aria-label="Close dialog">&times;</button>
      </header>
      <div id="modal-error" class="alert alert-error" role="alert" aria-live="assertive" aria-hidden="true"></div>
      <form id="edit-form" class="modal-form" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="ef-first-name">First name</label>
            <input type="text" id="ef-first-name" name="first_name" value="${esc(reservation.first_name)}" required autocomplete="off" />
          </div>
          <div class="form-group">
            <label for="ef-surname">Surname</label>
            <input type="text" id="ef-surname" name="surname" value="${esc(reservation.surname)}" required autocomplete="off" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="ef-telephone">Telephone</label>
            <input type="tel" id="ef-telephone" name="telephone" value="${esc(reservation.telephone || '')}" autocomplete="off" />
          </div>
          <div class="form-group">
            <label for="ef-email">Email</label>
            <input type="email" id="ef-email" name="email" value="${esc(reservation.email || '')}" autocomplete="off" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="ef-date">Date</label>
            <input type="date" id="ef-date" name="reservation_date" value="${esc(reservation.reservation_date)}" required />
          </div>
          <div class="form-group">
            <label for="ef-time">Time</label>
            <input type="time" id="ef-time" name="reservation_time" value="${esc(reservation.reservation_time)}" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="ef-guests">Guests</label>
            <input type="number" id="ef-guests" name="guests" value="${reservation.guests}" min="1" required />
          </div>
        </div>
        <div class="form-group">
          <label for="ef-dietary">Dietary requirements</label>
          <textarea id="ef-dietary" name="dietary_requirements" rows="2">${esc(reservation.dietary_requirements || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary" id="save-btn">Save changes</button>
          <button type="button" class="btn-secondary" id="cancel-btn">Cancel</button>
        </div>
      </form>
    `;

    inner.querySelector('.modal-close').addEventListener('click', closeModal);
    inner.querySelector('#cancel-btn').addEventListener('click', closeModal);

    inner.querySelector('#edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = inner.querySelector('#save-btn');
      const errorEl = inner.querySelector('#modal-error');
      errorEl.setAttribute('aria-hidden', 'true');
      errorEl.classList.remove('visible');
      saveBtn.disabled = true;
      saveBtn.classList.add('loading');

      const formData = new FormData(e.target);
      const body = {};
      for (const [k, v] of formData.entries()) {
        body[k] = k === 'guests' ? parseInt(v, 10) : v;
      }

      try {
        const res = await fetch(`/api/admin/reservations/${reservation.id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
        await checkResponse(res);
        closeModal();
        if (_onSuccess) _onSuccess();
      } catch (err) {
        if (err.message !== 'Unauthorized') {
          showModalError(inner, err.message || 'Failed to save changes.');
          saveBtn.disabled = false;
          saveBtn.classList.remove('loading');
        }
      }
    });

    openModal();
  }

  function openDelete(reservation, onSuccess) {
    _onSuccess = onSuccess;
    ensureDialog();

    const inner = dialog.querySelector('#modal-inner');
    inner.innerHTML = `
      <header class="modal-header">
        <h2>Delete Booking</h2>
        <button class="modal-close" aria-label="Close dialog">&times;</button>
      </header>
      <div id="modal-error" class="alert alert-error" role="alert" aria-live="assertive" aria-hidden="true"></div>
      <p class="modal-confirm-text">
        Delete booking for <strong>${esc(reservation.first_name)} ${esc(reservation.surname)}</strong>
        on <strong>${esc(reservation.reservation_date)}</strong> at <strong>${esc(reservation.reservation_time)}</strong>?
      </p>
      <p class="modal-confirm-subtext">This action cannot be undone.</p>
      <div class="modal-actions">
        <button class="btn-danger" id="delete-confirm-btn">Delete</button>
        <button class="btn-secondary" id="cancel-btn">Cancel</button>
      </div>
    `;

    inner.querySelector('.modal-close').addEventListener('click', closeModal);
    inner.querySelector('#cancel-btn').addEventListener('click', closeModal);

    inner.querySelector('#delete-confirm-btn').addEventListener('click', async () => {
      const deleteBtn = inner.querySelector('#delete-confirm-btn');
      const errorEl = inner.querySelector('#modal-error');
      errorEl.setAttribute('aria-hidden', 'true');
      errorEl.classList.remove('visible');
      deleteBtn.disabled = true;
      deleteBtn.classList.add('loading');

      try {
        const res = await fetch(`/api/admin/reservations/${reservation.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${AdminAuth.getToken()}` },
        });
        await checkResponse(res);
        closeModal();
        if (_onSuccess) _onSuccess();
      } catch (err) {
        if (err.message !== 'Unauthorized') {
          showModalError(inner, err.message || 'Failed to delete booking.');
          deleteBtn.disabled = false;
          deleteBtn.classList.remove('loading');
        }
      }
    });

    openModal();
  }

  return { openEdit, openDelete };
})();

window.BookingModal = BookingModal;
