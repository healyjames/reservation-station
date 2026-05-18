const BlockedDatesCalendar = (() => {
  let _container = null;
  let _viewYear = new Date().getFullYear();
  let _viewMonth = new Date().getMonth();
  let _blockedSet = new Set();
  let _rangeStart = null;
  let _isLoading = false;
  let _core = null;

  async function _loadCore() {
    if (!_core) _core = await import('/js/calendar-core.js');
    return _core;
  }

  function _pad(n) { return String(n).padStart(2, '0'); }

  function _toDateStr(y, m, d) {
    return `${y}-${_pad(m + 1)}-${_pad(d)}`;
  }

  function _toMonthStr(y, m) {
    return `${y}-${_pad(m + 1)}`;
  }

  function _isPastDay(y, m, d) {
    const t = new Date();
    if (y !== t.getFullYear()) return y < t.getFullYear();
    if (m !== t.getMonth()) return m < t.getMonth();
    return d < t.getDate();
  }

  function _showError(msg) {
    if (!_container) return;
    const el = _container.querySelector('.bd-calendar-error');
    if (!el) return;
    el.textContent = msg;
    el.removeAttribute('hidden');
    setTimeout(() => el.setAttribute('hidden', ''), 5000);
  }

  async function _render() {
    if (!_container) return;
    const loadingEl = _container.querySelector('.bd-calendar-loading');
    const gridEl    = _container.querySelector('.date-picker-grid');
    const labelEl   = _container.querySelector('.bd-month-label');
    const prevBtn   = _container.querySelector('.bd-prev-btn');

    const { MONTHS, renderCalendarGrid } = await _loadCore();

    if (labelEl) labelEl.textContent = `${MONTHS[_viewMonth]} ${_viewYear}`;

    const today = new Date();
    if (prevBtn) {
      const isCurrent = _viewYear === today.getFullYear() && _viewMonth === today.getMonth();
      prevBtn.disabled = isCurrent;
      prevBtn.style.pointerEvents = isCurrent ? 'none' : '';
    }

    if (_isLoading) {
      if (loadingEl) loadingEl.removeAttribute('hidden');
      if (gridEl) gridEl.style.visibility = 'hidden';
      return;
    }

    if (loadingEl) loadingEl.setAttribute('hidden', '');
    if (gridEl) gridEl.style.visibility = '';

    renderCalendarGrid(gridEl, _viewYear, _viewMonth, {
      cellClass: 'dp-day',
      headerClass: 'dp-day-name',
      isDisabled: (y, m, d) => _isPastDay(y, m, d),
      isBlocked: (y, m, d) => _blockedSet.has(_toDateStr(y, m, d)),
      onSelect: (y, m, d) => _handleDayClick(y, m, d),
    });

    _applyRangeStart(gridEl);
    _setupHoverListeners(gridEl);
  }

  function _applyRangeStart(gridEl) {
    if (!_rangeStart || _rangeStart.y !== _viewYear || _rangeStart.m !== _viewMonth) return;
    gridEl.querySelectorAll('.dp-day').forEach(cell => {
      if (parseInt(cell.textContent, 10) === _rangeStart.d) {
        cell.classList.add('dp-day--range-start');
      }
    });
  }

  function _setupHoverListeners(gridEl) {
    gridEl.addEventListener('mouseover', e => {
      if (!_rangeStart || _rangeStart.y !== _viewYear || _rangeStart.m !== _viewMonth) return;
      const cell = e.target.closest('.dp-day');
      if (!cell || cell.classList.contains('empty')) return;
      const hovered = parseInt(cell.textContent, 10);
      if (isNaN(hovered)) return;
      _updateRangeHover(gridEl, hovered);
    });
    gridEl.addEventListener('mouseleave', () => _clearRangeHover(gridEl));
  }

  function _updateRangeHover(gridEl, hovered) {
    _clearRangeHover(gridEl);
    if (!_rangeStart) return;
    const lo = Math.min(_rangeStart.d, hovered);
    const hi = Math.max(_rangeStart.d, hovered);
    gridEl.querySelectorAll('.dp-day').forEach(cell => {
      const d = parseInt(cell.textContent, 10);
      if (isNaN(d) || d < lo || d > hi) return;
      if (d === _rangeStart.d) {
        cell.classList.add('dp-day--range-start');
      } else if (d === hovered) {
        cell.classList.add('dp-day--range-end');
      } else {
        cell.classList.add('dp-day--in-range');
      }
    });
  }

  function _clearRangeHover(gridEl) {
    gridEl.querySelectorAll('.dp-day--in-range, .dp-day--range-end').forEach(cell => {
      cell.classList.remove('dp-day--in-range', 'dp-day--range-end');
    });
  }

  async function _handleDayClick(y, m, d) {
    if (_isLoading) return;
    if (!_rangeStart) {
      _rangeStart = { y, m, d };
      const gridEl = _container.querySelector('.date-picker-grid');
      if (gridEl) _applyRangeStart(gridEl);
      return;
    }
    const start = _rangeStart;
    _rangeStart = null;
    if (start.y === y && start.m === m && start.d === d) {
      await _toggleDay(y, m, d);
    } else if (start.y === y && start.m === m) {
      await _blockRange(y, m, Math.min(start.d, d), Math.max(start.d, d));
    } else {
      await _toggleDay(y, m, d);
    }
  }

  async function _toggleDay(y, m, d) {
    const dateStr = _toDateStr(y, m, d);
    if (_blockedSet.has(dateStr)) {
      await _unblockDay(dateStr);
    } else {
      await _blockDay(dateStr);
    }
  }

  async function _blockDay(dateStr) {
    _isLoading = true;
    await _render();
    try {
      const res = await fetch('/api/admin/blocked-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AdminAuth.getToken()}`,
        },
        body: JSON.stringify({ date: dateStr }),
      });
      if (res.status === 401) { AdminAuth.logout(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      _blockedSet.add(dateStr);
    } catch {
      _showError('Failed to block date.');
    } finally {
      _isLoading = false;
      _render();
    }
  }

  async function _unblockDay(dateStr) {
    _isLoading = true;
    await _render();
    try {
      const res = await fetch(`/api/admin/blocked-dates/date/${dateStr}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AdminAuth.getToken()}` },
      });
      if (res.status === 401) { AdminAuth.logout(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      _blockedSet.delete(dateStr);
    } catch {
      _showError('Failed to unblock date.');
    } finally {
      _isLoading = false;
      _render();
    }
  }

  async function _blockRange(y, m, startDay, endDay) {
    _isLoading = true;
    await _render();
    try {
      const ops = [];
      for (let d = startDay; d <= endDay; d++) {
        const dateStr = _toDateStr(y, m, d);
        if (_blockedSet.has(dateStr)) continue;
        ops.push(
          fetch('/api/admin/blocked-dates', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${AdminAuth.getToken()}`,
            },
            body: JSON.stringify({ date: dateStr }),
          }).then(res => {
            if (res.status === 401) { AdminAuth.logout(); throw new Error('401'); }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            _blockedSet.add(dateStr);
          })
        );
      }
      await Promise.all(ops);
    } catch {
      _showError('Failed to block some dates.');
    } finally {
      _isLoading = false;
      _render();
    }
  }

  async function _loadMonth(y, m) {
    _isLoading = true;
    _render();
    try {
      const res = await fetch(`/api/admin/blocked-dates?month=${_toMonthStr(y, m)}`, {
        headers: { 'Authorization': `Bearer ${AdminAuth.getToken()}` },
      });
      if (res.status === 401) { AdminAuth.logout(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _blockedSet = new Set((data || []).filter(b => !b.start_time).map(b => b.date));
    } catch {
      _showError('Failed to load blocked dates.');
    } finally {
      _isLoading = false;
      _render();
    }
  }

  function init(container) {
    _container = container;
    _viewYear  = new Date().getFullYear();
    _viewMonth = new Date().getMonth();
    _blockedSet = new Set();
    _rangeStart = null;
    _isLoading  = false;

    container.innerHTML = `
      <h3 class="bd-section-title">Blocked Dates</h3>
      <div class="date-picker-popup date-picker-popup--inline">
        <div class="date-picker-header">
          <button class="bd-prev-btn" aria-label="Previous month">&#8592;</button>
          <span class="bd-month-label"></span>
          <button class="bd-next-btn" aria-label="Next month">&#8594;</button>
        </div>
        <div class="bd-calendar-loading loading-text" hidden>Loading…</div>
        <div class="bd-calendar-error error-text" hidden></div>
        <div class="date-picker-grid" role="grid"></div>
        <div class="bd-legend">
          <span class="bd-legend-item"><span class="bd-legend-swatch bd-legend-swatch--blocked"></span> Blocked</span>
          <span class="bd-legend-item bd-legend-hint">◌ Click to toggle · Click two days to block a range</span>
        </div>
      </div>
    `;

    container.querySelector('.bd-prev-btn').addEventListener('click', () => {
      _viewMonth -= 1;
      if (_viewMonth < 0) { _viewMonth = 11; _viewYear -= 1; }
      _rangeStart = null;
      _loadMonth(_viewYear, _viewMonth);
    });

    container.querySelector('.bd-next-btn').addEventListener('click', () => {
      _viewMonth += 1;
      if (_viewMonth > 11) { _viewMonth = 0; _viewYear += 1; }
      _rangeStart = null;
      _loadMonth(_viewYear, _viewMonth);
    });

    _loadMonth(_viewYear, _viewMonth);
  }

  return { init };
})();

const SettingsManager = (() => {
  function init(container) {
    container.innerHTML = `
      <div class="settings-panel">
        <h2>Settings</h2>
        <div id="settings-error" class="alert alert-error" role="alert" aria-live="assertive" aria-hidden="true"></div>
        <div id="settings-success" class="alert alert-success" role="status" aria-live="polite" aria-hidden="true">Settings saved.</div>
        <form id="settings-form" novalidate>
          <div class="form-group">
            <label for="sf-name">Name</label>
            <input type="text" id="sf-name" name="name" required autocomplete="organization" />
          </div>
          <div class="form-group">
            <label for="sf-max-guests">Max party size</label>
            <input type="number" id="sf-max-guests" name="max_guests" min="0" />
          </div>
          <div class="form-group">
            <label for="sf-max-covers">Max covers per day</label>
            <input type="number" id="sf-max-covers" name="max_covers" min="0" />
          </div>
          <div class="form-group">
            <label for="sf-time-window">
              Concurrent guest time window (minutes)
              <button type="button" class="info-trigger" aria-label="What is this?" aria-describedby="time-window-tooltip"><span aria-hidden="true">?</span></button>
              <span class="info-tooltip" id="time-window-tooltip" role="tooltip">No more than <strong id="tt-max-cover">-</strong> guests can be booked across any rolling <strong id="tt-time-window">-</strong>-minute window.</span>
            </label>
            <input type="number" id="sf-time-window" name="concurrent_guests_time_limit" min="0" />
          </div>
          <p class="tz-note">Times are in your local timezone.</p>
          <button type="submit" class="btn-primary" id="settings-save-btn">Save settings</button>
        </form>
        <div id="blocked-dates-section"></div>
      </div>
    `;

    loadSettings(container);
    BlockedDatesCalendar.init(container.querySelector('#blocked-dates-section'));

    container.querySelector('#sf-max-covers').addEventListener('input', () => updateTooltip(container));
    container.querySelector('#sf-time-window').addEventListener('input', () => updateTooltip(container));

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
      container.querySelector('#sf-time-window').value = tenant.concurrent_guests_time_limit ?? 0;
      updateTooltip(container);
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

function updateTooltip(container) {
  const maxCovers = parseInt(container.querySelector('#sf-max-covers').value, 10);
  const timeWindow = parseInt(container.querySelector('#sf-time-window').value, 10);
  const ttMax = container.querySelector('#tt-max-cover');
  const ttTime = container.querySelector('#tt-time-window');
  if (ttMax) ttMax.textContent = maxCovers > 0 ? maxCovers : 'unlimited';
  if (ttTime) ttTime.textContent = timeWindow > 0 ? timeWindow : '–';
}

window.SettingsManager = SettingsManager;
