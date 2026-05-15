(function () {
  let calendarCore = null;

  async function loadCore() {
    if (!calendarCore) calendarCore = await import('/js/calendar-core.js');
    return calendarCore;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  const DatePicker = {
    _popup: null,
    _trigger: null,
    _onDateSelect: null,
    _year: 0,
    _month: 0,

    init(triggerEl, onDateSelect) {
      this._trigger = triggerEl;
      this._onDateSelect = onDateSelect;

      const today = new Date();
      this._year  = today.getFullYear();
      this._month = today.getMonth();

      triggerEl.setAttribute('role', 'button');
      triggerEl.setAttribute('tabindex', '0');
      triggerEl.setAttribute('aria-haspopup', 'true');
      triggerEl.classList.add('date-picker-trigger');

      const popup = document.createElement('div');
      popup.className = 'date-picker-popup';
      popup.setAttribute('hidden', '');
      popup.innerHTML = `
        <div class="date-picker-header">
          <button id="dp-prev-month" aria-label="Previous month">&#8592;</button>
          <span id="dp-title"></span>
          <button id="dp-next-month" aria-label="Next month">&#8594;</button>
        </div>
        <div class="date-picker-grid" id="dp-grid" role="grid"></div>
      `;

      document.body.appendChild(popup);
      this._popup = popup;

      popup.querySelector('#dp-prev-month').addEventListener('click', (e) => {
        e.stopPropagation();
        this._month -= 1;
        if (this._month < 0) { this._month = 11; this._year -= 1; }
        this._render();
      });

      popup.querySelector('#dp-next-month').addEventListener('click', (e) => {
        e.stopPropagation();
        this._month += 1;
        if (this._month > 11) { this._month = 0; this._year += 1; }
        this._render();
      });

      triggerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this._popup.hidden) {
          this._close();
        } else {
          this._open();
        }
      });

      triggerEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!this._popup.hidden) {
            this._close();
          } else {
            this._open();
          }
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this._popup.hidden) {
          this._close();
        }
      });

      document.addEventListener('click', (e) => {
        if (!this._popup.hidden && !this._popup.contains(e.target) && e.target !== this._trigger) {
          this._close();
        }
      });
    },

    _open() {
      const today = new Date();
      this._year  = today.getFullYear();
      this._month = today.getMonth();

      this._popup.removeAttribute('hidden');
      this._position();
      this._render();
    },

    _close() {
      this._popup.setAttribute('hidden', '');
    },

    _position() {
      const rect = this._trigger.getBoundingClientRect();
      this._popup.style.top  = (rect.bottom + 6) + 'px';
      this._popup.style.left = rect.left + 'px';
    },

    async _render() {
      const core    = await loadCore();
      const titleEl = this._popup.querySelector('#dp-title');
      const gridEl  = this._popup.querySelector('#dp-grid');

      titleEl.textContent = `${core.MONTHS[this._month]} ${this._year}`;

      core.renderCalendarGrid(gridEl, this._year, this._month, {
        onSelect: (y, m, d) => {
          this._onDateSelect(`${y}-${pad(m + 1)}-${pad(d)}`);
          this._close();
        },
      });
    },
  };

  window.DatePicker = DatePicker;
})();
