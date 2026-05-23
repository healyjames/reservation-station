import type { Reservation } from '../types/reservation';

/**
 * Escapes HTML special characters.
 * NOTE: This is a shim for the vanilla JS migration period only.
 * Once JSX replaces all innerHTML usage, this can be deleted.
 * @deprecated Remove after all vanilla JS surfaces are migrated.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Returns "First Surname" or "Guest" if names are missing */
export function getFullName(reservation: Pick<Reservation, 'first_name' | 'surname'>): string {
  return [reservation.first_name, reservation.surname].filter(Boolean).join(' ').trim() || 'Guest';
}

/** Returns "N guest" or "N guests" */
export function getGuestsLabel(guests: number): string {
  return `${guests} guest${guests === 1 ? '' : 's'}`;
}
