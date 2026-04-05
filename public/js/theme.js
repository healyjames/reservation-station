// Apply theme from ?theme= URL parameter before first render to avoid flash
(function () {
  var THEMES = {
    'default': {
      light: {
        '--primary':           '#8b2635',
        '--primary-lighter':   '#b5475a',
        '--primary-lightest':  '#f5e8ea',
        '--primary-darker':    '#5c1521',
        '--background':        '#f3ede8',
        '--background-light':  '#faf7f5',
        '--background-darker': '#c8b8ae',
        '--foreground':        '#1c1412',
        '--grey-lightest':     '#f5f5f5',
      },
      dark: {
        '--primary':           '#c45a6a',
        '--primary-lighter':   '#e07a8a',
        '--primary-lightest':  '#3d1a20',
        '--primary-darker':    '#a33d4a',
        '--background':        '#1a1210',
        '--background-light':  '#251918',
        '--background-darker': '#2e1e1c',
        '--foreground':        '#f3ede8',
        '--grey-lightest':     '#2e1e1c',
      },
    },
    'caffeine': {
      light: {
        '--primary':           '#644a40',
        '--primary-lighter':   '#8a6456',
        '--primary-lightest':  '#e8e8e8',
        '--primary-darker':    '#3e2e28',
        '--background':        '#f9f9f9',
        '--background-light':  '#fcfcfc',
        '--background-darker': '#efefef',
        '--foreground':        '#202020',
        '--grey-lightest':     '#efefef',
      },
      dark: {
        '--primary':           '#ffe0c2',
        '--primary-lighter':   '#fff0e0',
        '--primary-lightest':  '#2a2a2a',
        '--primary-darker':    '#393028',
        '--background':        '#111111',
        '--background-light':  '#191919',
        '--background-darker': '#222222',
        '--foreground':        '#eeeeee',
        '--grey-lightest':     '#222222',
      },
    },
    'clean-slate': {
      light: {
        '--primary':           '#6366f1',
        '--primary-lighter':   '#818cf8',
        '--primary-lightest':  '#e0e7ff',
        '--primary-darker':    '#4f46e5',
        '--background':        '#f8fafc',
        '--background-light':  '#ffffff',
        '--background-darker': '#e5e7eb',
        '--foreground':        '#1e293b',
        '--grey-lightest':     '#f3f4f6',
      },
      dark: {
        '--primary':           '#818cf8',
        '--primary-lighter':   '#a5b4fc',
        '--primary-lightest':  '#374151',
        '--primary-darker':    '#4f46e5',
        '--background':        '#0f172a',
        '--background-light':  '#1e293b',
        '--background-darker': '#152032',
        '--foreground':        '#e2e8f0',
        '--grey-lightest':     '#2d3748',
      },
    },
    'kodama-grove': {
      light: {
        '--primary':           '#8d9d4f',
        '--primary-lighter':   '#9db18c',
        '--primary-lightest':  '#dbc894',
        '--primary-darker':    '#71856a',
        '--background':        '#e4d7b0',
        '--background-light':  '#e7dbbf',
        '--background-darker': '#b19681',
        '--foreground':        '#5c4b3e',
        '--grey-lightest':     '#decea0',
      },
      dark: {
        '--primary':           '#8a9f7b',
        '--primary-lighter':   '#9db18c',
        '--primary-lightest':  '#4a4439',
        '--primary-darker':    '#71856a',
        '--background':        '#3a3529',
        '--background-light':  '#413c33',
        '--background-darker': '#4a4439',
        '--foreground':        '#ede4d4',
        '--grey-lightest':     '#4a4439',
      },
    },
    'mocha-mousse': {
      light: {
        '--primary':           '#A37764',
        '--primary-lighter':   '#C39E88',
        '--primary-lightest':  '#E4C7B8',
        '--primary-darker':    '#8A655A',
        '--background':        '#F1F0E5',
        '--background-light':  '#ebd6cb',
        '--background-darker': '#BAAB92',
        '--foreground':        '#56453F',
        '--grey-lightest':     '#e4c7b8',
      },
      dark: {
        '--primary':           '#C39E88',
        '--primary-lighter':   '#d4b89e',
        '--primary-lightest':  '#56453F',
        '--primary-darker':    '#A37764',
        '--background':        '#2d2521',
        '--background-light':  '#3c332e',
        '--background-darker': '#56453F',
        '--foreground':        '#F1F0E5',
        '--grey-lightest':     '#56453F',
      },
    },
    'sage-garden': {
      light: {
        '--primary':           '#7c9082',
        '--primary-lighter':   '#a0aa88',
        '--primary-lightest':  '#bfc9bb',
        '--primary-darker':    '#5a6b5e',
        '--background':        '#f8f7f4',
        '--background-light':  '#ffffff',
        '--background-darker': '#e8e6e1',
        '--foreground':        '#1a1f2e',
        '--grey-lightest':     '#e8e6e1',
      },
      dark: {
        '--primary':           '#7c9082',
        '--primary-lighter':   '#a0aa88',
        '--primary-lightest':  '#36443a',
        '--primary-darker':    '#5a6b5e',
        '--background':        '#0a0a0a',
        '--background-light':  '#121212',
        '--background-darker': '#1a1a1a',
        '--foreground':        '#f5f5f5',
        '--grey-lightest':     '#1a1a1a',
      },
    },
  };

  var params = new URLSearchParams(window.location.search);
  var themeName = params.get('theme') || 'caffeine';
  var mode = params.get('mode') === 'light' ? 'light' : 'dark';
  var themeSet = THEMES[themeName] || THEMES['caffeine'];
  var theme = themeSet[mode];
  var root = document.documentElement;
  Object.keys(theme).forEach(function (prop) {
    root.style.setProperty(prop, theme[prop]);
  });
})();
