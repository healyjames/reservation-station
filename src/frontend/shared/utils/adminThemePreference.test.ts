// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_MODE_STORAGE_KEY, readAdminMode, saveAdminMode } from './adminThemePreference';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('adminThemePreference', () => {
  it('reads back a saved mode', () => {
    saveAdminMode('light');
    expect(readAdminMode()).toBe('light');
    saveAdminMode('dark');
    expect(readAdminMode()).toBe('dark');
  });

  it('reads nothing saved as null', () => {
    expect(readAdminMode()).toBeNull();
  });

  it('reads an unknown value as null', () => {
    window.localStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'purple');
    expect(readAdminMode()).toBeNull();
  });

  it('reads null when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readAdminMode()).toBeNull();
  });

  it('does not throw when saving to storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveAdminMode('light')).not.toThrow();
  });
});
