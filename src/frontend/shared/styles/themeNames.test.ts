// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_MODE_STORAGE_KEY } from '@shared/utils/adminThemePreference';

// Theme names live in three places: PALETTES in public/js/theme.js (plain JS, loaded before the app), the Palette type in
// themes.ts, and the `name:` lines of the theme CSS. A palette added to only one of them silently falls back to
// default-dark, so this test keeps them in step and runs theme.js itself.

// jsdom replaces the global URL, so paths come from the repo root (Vitest runs there) rather than import.meta.url.
const stylesDir = join(process.cwd(), 'src', 'frontend', 'shared', 'styles');
const themeJs = readFileSync(join(process.cwd(), 'public', 'js', 'theme.js'), 'utf8');
const themesTs = readFileSync(join(stylesDir, 'themes.ts'), 'utf8');
const cssNames = (file: string) => [...readFileSync(join(stylesDir, file), 'utf8').matchAll(/name: '([^']+)'/g)].map((m) => m[1]);

const quoted = (text: string) => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const jsPalettes = quoted(/var PALETTES = \[([^\]]+)\]/.exec(themeJs)![1]);
const tsPalettes = quoted(/export type Palette = ([^;]+);/.exec(themesTs)![1]);
const MODES = ['light', 'dark'];
const ADMIN = 'admin';

describe('theme names', () => {
  it('lists the same palettes in theme.js and themes.ts', () => {
    expect(jsPalettes).toEqual(tsPalettes);
    expect(jsPalettes).toHaveLength(6);
  });

  it('defines a light and dark public theme for every palette, and nothing else', () => {
    expect(cssNames('themes-public.css').sort()).toEqual(jsPalettes.flatMap((p) => MODES.map((m) => `${p}-${m}`)).sort());
  });

  it('defines admin-light and admin-dark', () => {
    expect(cssNames('themes-admin.css').sort()).toEqual(['admin-dark', 'admin-light']);
  });

  it('reads the admin mode from the key the app saves it under', () => {
    expect(themeJs).toContain(`'${ADMIN_MODE_STORAGE_KEY}'`);
  });
});

/** Runs public/js/theme.js as the page would, and returns the `data-theme` it set. */
function runThemeJs(search: string, scope?: 'admin'): string | null {
  window.history.replaceState(null, '', `/${search}`);
  document.documentElement.removeAttribute('data-theme');
  const script = document.createElement('script');
  if (scope) script.setAttribute('data-theme-scope', scope);
  vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
  new Function(themeJs)();
  return document.documentElement.getAttribute('data-theme');
}

describe('theme.js', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it.each(jsPalettes.flatMap((palette) => MODES.map((mode) => [palette, mode])))('sets %s-%s from the URL', (palette, mode) => {
    expect(runThemeJs(`?theme=${palette}&mode=${mode}`)).toBe(`${palette}-${mode}`);
  });

  it('defaults public pages to default-dark, and ignores an unknown palette or mode', () => {
    expect(runThemeJs('')).toBe('default-dark');
    expect(runThemeJs('?theme=__proto__&mode=sepia')).toBe('default-dark');
  });

  it('gives admin its own theme, ignoring ?theme=', () => {
    expect(runThemeJs('?theme=caffeine&mode=light', ADMIN)).toBe('admin-light');
  });

  it("uses admin's saved mode, unless ?mode= says otherwise", () => {
    window.localStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'light');
    expect(runThemeJs('', ADMIN)).toBe('admin-light');
    expect(runThemeJs('?mode=dark', ADMIN)).toBe('admin-dark');
  });

  it('falls back to admin-dark for nothing saved, a bad saved value, or unavailable storage', () => {
    expect(runThemeJs('', ADMIN)).toBe('admin-dark');
    window.localStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'purple');
    expect(runThemeJs('', ADMIN)).toBe('admin-dark');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(runThemeJs('', ADMIN)).toBe('admin-dark');
  });
});
