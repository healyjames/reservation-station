(function () {
  const DEFAULT_VIEW = 'general';
  const viewRenderers = {
    general: (container) => SettingsManager.initFormOnly(container),
    'opening-hours': (container) => OpeningHoursManager.init(container),
    'blocked-dates': (container) => BlockedDatesCalendar.init(container),
  };

  function getActiveView() {
    const hash = window.location.hash.replace(/^#/, '');
    return viewRenderers[hash] ? hash : DEFAULT_VIEW;
  }

  function syncHash() {
    const view = getActiveView();
    if (window.location.hash !== `#${view}`) {
      history.replaceState(null, '', `${window.location.pathname}#${view}`);
    }
    return view;
  }

  function setSubnavExpanded(parentBtn, subnav, expanded) {
    parentBtn.setAttribute('aria-expanded', String(expanded));
    subnav.hidden = !expanded;
  }

  function updateActiveNav(buttons, activeView) {
    buttons.forEach((button) => {
      button.classList.toggle('active', button.dataset.hash === activeView);
    });
  }

  function renderActiveView(container, buttons) {
    const activeView = syncHash();
    updateActiveNav(buttons, activeView);
    viewRenderers[activeView](container);
  }

  async function loadTenantName() {
    try {
      const res = await fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${AdminAuth.getToken()}` },
      });
      if (res.status === 401) { AdminAuth.logout(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tenant = await res.json();
      const nameEl = document.getElementById('venue-name');
      if (nameEl) nameEl.textContent = tenant.name || 'Settings';
    } catch (_) {}
  }

  async function init() {
    AdminAuth.requireAuth();

    const cached = AdminAuth.getTenant();
    if (cached && cached.name) {
      const nameEl = document.getElementById('venue-name');
      if (nameEl) nameEl.textContent = cached.name;
    }

    const logoutButton = document.getElementById('logout-btn');
    const container = document.getElementById('settings-view');
    const parentBtn = document.getElementById('settings-parent-btn');
    const subnav = document.getElementById('settings-subnav');
    const subnavButtons = Array.from(subnav.querySelectorAll('[data-hash]'));

    logoutButton.addEventListener('click', () => AdminAuth.logout());

    parentBtn.addEventListener('click', () => {
      const expanded = parentBtn.getAttribute('aria-expanded') === 'true';
      setSubnavExpanded(parentBtn, subnav, !expanded);
    });

    subnavButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextHash = `#${button.dataset.hash}`;
        setSubnavExpanded(parentBtn, subnav, true);
        if (window.location.hash === nextHash) {
          renderActiveView(container, subnavButtons);
          return;
        }
        window.location.hash = nextHash;
      });
    });

    window.addEventListener('hashchange', () => renderActiveView(container, subnavButtons));

    setSubnavExpanded(parentBtn, subnav, true);
    await loadTenantName();
    renderActiveView(container, subnavButtons);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
