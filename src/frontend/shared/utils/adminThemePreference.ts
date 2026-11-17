import type { ThemeMode } from '@shared/styles/themes';

/** Also read by public/js/theme.js (plain JS, so it repeats this key). Keep them the same. */
export const ADMIN_MODE_STORAGE_KEY = 'admin-theme-mode';

/** The admin's saved light/dark choice, or null when there is none, it is not a mode, or storage is unavailable. */
export function readAdminMode(): ThemeMode | null {
  try {
    const value = window.localStorage.getItem(ADMIN_MODE_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Saves the admin's light/dark choice. Does nothing when storage is unavailable (private mode, blocked site data). */
export function saveAdminMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(ADMIN_MODE_STORAGE_KEY, mode);
  } catch {
    // The choice simply is not remembered.
  }
}
