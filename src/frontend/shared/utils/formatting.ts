import type { Reservation } from '../types/reservation';

export function getFullName(reservation: Pick<Reservation, 'first_name' | 'surname'>): string {
  return [reservation.first_name, reservation.surname].filter(Boolean).join(' ').trim() || 'Guest';
}

export function getGuestsLabel(guests: number): string {
  return `${guests} guest${guests === 1 ? '' : 's'}`;
}
