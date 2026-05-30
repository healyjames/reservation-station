import type { Reservation } from '../types/reservation';

/** Returns "First Surname" or "Guest" if names are missing */
export function getFullName(reservation: Pick<Reservation, 'first_name' | 'surname'>): string {
  return [reservation.first_name, reservation.surname].filter(Boolean).join(' ').trim() || 'Guest';
}

/** Returns "N guest" or "N guests" */
export function getGuestsLabel(guests: number): string {
  return `${guests} guest${guests === 1 ? '' : 's'}`;
}
