const SettingsManager = (() => {
  function init(container) {
    container.innerHTML = `
      <div class="settings-panel">
        <h2>Venue Settings</h2>
        <div id="settings-error" class="alert alert-error" role="alert" aria-live="assertive" aria-hidden="true"></div>
        <div id="settings-success" class="alert alert-success" role="status" aria-live="polite" aria-hidden="true">Settings saved.</div>
        <form id="settings-form" novalidate>
          <div class="form-group">
            <label for="sf-name">Venue name</label>
            <input type="text" id="sf-name" name="name" required autocomplete="organization" />
          </div>
          <div class="form-group">
            <label for="sf-max-guests">Max concurrent guests</label>
            <span class="field-hint">0 = unlimited</span>
            <input type="number" id="sf-max-guests" name="max_guests" min="0" />
          </div>
          <div class="form-group">
            <label for="sf-max-covers">Max covers per day</label>
            <span class="field-hint">0 = unlimited</span>
            <input type="number" id="sf-max-covers" name="max_covers" min="0" />
          </div>
          <div class="form-group form-group-check">
            <input type="checkbox" id="sf-block-today" name="block_current_day" />
            <label for="sf-block-today">Block same-day bookings</label>
          </div>
          <div class="form-group">
            <label for="sf-time-window">Concurrent guest time window (minutes)</label>
            <input type="number" id="sf-time-window" name="concurrent_guests_time_limit" min="0" />
          </div>
          <p class="tz-note">Times are in your local timezone.</p>
          <button type="submit" class="btn-primary" id="settings-save-btn">Save settings</button>
        </form>
      </div>
    `;

    loadSettings(container);

    container.querySelector('#settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveSettings(container);
    });
  }

  async function loadSettings(container) {
    try {
      const res = await fetch('/api/admin/me', {
        headers: { 'Authorization': `Bearer ${AdminAuth.getToken()}` },
      });
      if (res.status === 401) { AdminAuth.logout(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const tenant = await res.json();
      container.querySelector('#sf-name').value = tenant.name || '';
      container.querySelector('#sf-max-guests').value = tenant.max_guests ?? 0;
      container.querySelector('#sf-max-covers').value = tenant.max_covers ?? 0;
      container.querySelector('#sf-block-today').checked = !!tenant.block_current_day;
      container.querySelector('#sf-time-window').value = tenant.concurrent_guests_time_limit ?? 0;
    } catch (err) {
      const el = container.querySelector('#settings-error');
      el.textContent = 'Failed to load settings. Please refresh.';
      el.setAttribute('aria-hidden', 'false');
      el.classList.add('visible');
    }
  }

  async function saveSettings(container) {
    const btn = container.querySelector('#settings-save-btn');
    const errorEl = container.querySelector('#settings-error');
    const successEl = container.querySelector('#settings-success');

    btn.disabled = true;
    btn.classList.add('loading');
    errorEl.setAttribute('aria-hidden', 'true');
    errorEl.classList.remove('visible');
    successEl.setAttribute('aria-hidden', 'true');
    successEl.classList.remove('visible');

    const body = {
      name: container.querySelector('#sf-name').value.trim(),
      max_guests: parseInt(container.querySelector('#sf-max-guests').value, 10) || 0,
      max_covers: parseInt(container.querySelector('#sf-max-covers').value, 10) || 0,
      block_current_day: container.querySelector('#sf-block-today').checked ? 1 : 0,
      concurrent_guests_time_limit: parseInt(container.querySelector('#sf-time-window').value, 10) || 0,
    };

    try {
      const res = await fetch('/api/admin/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AdminAuth.getToken()}`,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { AdminAuth.logout(); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      successEl.setAttribute('aria-hidden', 'false');
      successEl.classList.add('visible');

      const nameEl = document.getElementById('venue-name');
      if (nameEl && body.name) nameEl.textContent = body.name;

      const printNameEl = document.getElementById('print-venue-name');
      if (printNameEl && body.name) printNameEl.textContent = body.name;

      setTimeout(() => {
        successEl.setAttribute('aria-hidden', 'true');
        successEl.classList.remove('visible');
      }, 3000);
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to save settings.';
      errorEl.setAttribute('aria-hidden', 'false');
      errorEl.classList.add('visible');
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }

  return { init };
})();

window.SettingsManager = SettingsManager;
