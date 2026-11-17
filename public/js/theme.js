// Pick the daisyUI theme before first paint. The themes are defined in src/frontend/shared/styles/themes-public.css
// (palettes) and themes-admin.css (admin).
// Public pages: ?theme=<palette>&mode=<light|dark>, giving data-theme="<palette>-<mode>".
// Admin (script tag has data-theme-scope="admin"): ignores ?theme= and uses admin-<mode>, where the mode is ?mode=, else
// the admin's saved choice (localStorage, same key as shared/utils/adminThemePreference.ts), else dark.
// Public pages default to dark; the URL decides, not the OS preference.
(function () {
  var PALETTES = ['default', 'caffeine', 'clean-slate', 'kodama-grove', 'mocha-mousse', 'sage-garden'];

  var script = document.currentScript;
  var isAdmin = !!script && script.getAttribute('data-theme-scope') === 'admin';
  var ADMIN_MODE_STORAGE_KEY = 'admin-theme-mode';

  var params = new URLSearchParams(window.location.search);
  var requestedMode = params.get('mode');
  if (isAdmin && requestedMode !== 'light' && requestedMode !== 'dark') {
    try {
      requestedMode = window.localStorage.getItem(ADMIN_MODE_STORAGE_KEY);
    } catch (e) {
      requestedMode = null;
    }
  }
  var mode = requestedMode === 'light' ? 'light' : 'dark';
  var requested = params.get('theme');
  var palette = isAdmin ? 'admin' : PALETTES.indexOf(requested) === -1 ? 'default' : requested;

  document.documentElement.setAttribute('data-theme', palette + '-' + mode);
})();
