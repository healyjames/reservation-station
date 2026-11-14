// Pick the daisyUI theme before first paint. The themes are defined in src/frontend/shared/styles/themes.css.
// Public pages: ?theme=<palette>&mode=<light|dark>, giving data-theme="<palette>-<mode>".
// Admin (script tag has data-theme-scope="admin"): ignores ?theme= and uses admin-<mode>.
// Mode defaults to dark; the URL decides it, not the OS preference.
(function () {
  var PALETTES = ['default', 'caffeine', 'clean-slate', 'kodama-grove', 'mocha-mousse', 'sage-garden'];

  var script = document.currentScript;
  var isAdmin = !!script && script.getAttribute('data-theme-scope') === 'admin';
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('mode') === 'light' ? 'light' : 'dark';
  var requested = params.get('theme');
  var palette = isAdmin ? 'admin' : PALETTES.indexOf(requested) === -1 ? 'default' : requested;

  document.documentElement.setAttribute('data-theme', palette + '-' + mode);
})();
