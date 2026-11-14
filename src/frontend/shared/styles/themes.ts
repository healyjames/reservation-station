// The daisyUI theme names defined in ./themes.css. Keep in step with PALETTES in public/js/theme.js (plain JS, so it
// cannot import this).

export type ThemeMode = 'light' | 'dark';

export type Palette = 'default' | 'caffeine' | 'clean-slate' | 'kodama-grove' | 'mocha-mousse' | 'sage-garden';

export type ThemeName = `${Palette | 'admin'}-${ThemeMode}`;
