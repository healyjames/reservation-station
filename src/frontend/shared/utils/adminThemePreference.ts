import type { ThemeMode } from '@shared/styles/themes';

/** public/js/theme.js reads this key before first paint (plain JS, so it repeats it; themeNames.test.ts checks they match). */
export const ADMIN_MODE_STORAGE_KEY = 'admin-theme-mode';

/** Saves the admin's light/dark choice. Does nothing when storage is unavailable (private mode, blocked site data). */
export function saveAdminMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(ADMIN_MODE_STORAGE_KEY, mode);
  } catch {
    // The choice simply is not remembered.
  }
}
