// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_MODE_STORAGE_KEY, saveAdminMode } from './adminThemePreference';

// Reading the saved mode is public/js/theme.js's job; shared/styles/themeNames.test.ts covers it.
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('saveAdminMode', () => {
  it('saves the mode under the key theme.js reads', () => {
    saveAdminMode('light');
    expect(window.localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBe('light');
    saveAdminMode('dark');
    expect(window.localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBe('dark');
  });

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveAdminMode('light')).not.toThrow();
  });
});
