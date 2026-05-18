(function () {
  async function init() {
    AdminAuth.requireAuth();

    const cached = AdminAuth.getTenant();
    if (cached && cached.name) {
      const nameEl = document.getElementById('venue-name');
      if (nameEl) nameEl.textContent = cached.name;
    }

    document.getElementById('logout-btn').addEventListener('click', () => AdminAuth.logout());

    // Load fresh tenant name for the header
    try {
      const res = await fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${AdminAuth.getToken()}` },
      });
      if (res.status === 401) { AdminAuth.logout(); return; }
      if (res.ok) {
        const tenant = await res.json();
        const nameEl = document.getElementById('venue-name');
        if (nameEl) nameEl.textContent = tenant.name || 'Settings';
      }
    } catch (_) {}

    SettingsManager.init(document.getElementById('settings-view'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
