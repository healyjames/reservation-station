// @vitest-environment jsdom
import { fireEvent, render, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Reservation } from '@shared/types';
import ReservationList from './ReservationList';
import BookingCards from './BookingCards';

const make = (overrides: Partial<Reservation>): Reservation => ({
  id: 'r1',
  tenant_id: 't1',
  first_name: 'Alex',
  surname: 'Guest',
  telephone: '01234567890',
  email: 'alex@example.com',
  reservation_date: '2099-06-20',
  reservation_time: '19:00',
  guests: 2,
  ...overrides,
});

const reservations = [
  make({ id: 'r1', first_name: 'Emma', surname: 'Wilson', reservation_time: '12:30', guests: 2, dietary_requirements: 'No nuts' }),
  make({ id: 'r2', first_name: 'David', surname: 'Clark', reservation_time: '19:30', guests: 1 }),
];

describe('ReservationList', () => {
  it('is a named table with one row per booking', () => {
    const { getByRole } = render(<ReservationList reservations={reservations} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const table = getByRole('table', { name: 'Bookings for this day' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Time', 'Name', 'Guests', 'Notes', 'Actions']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[1].textContent)).toEqual(['Emma Wilson', 'David Clark']);
    expect(within(rows[1]).getAllByRole('cell')[3].textContent).toBe('–');
  });

  it('names Edit and Delete with the guest, and passes the booking on', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { getByRole } = render(<ReservationList reservations={reservations} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(getByRole('button', { name: /Edit booking for Emma Wilson/ }));
    fireEvent.click(getByRole('button', { name: /Delete booking for David Clark/ }));

    expect(onEdit).toHaveBeenCalledWith(reservations[0]);
    expect(onDelete).toHaveBeenCalledWith(reservations[1]);
  });
});

describe('BookingCards', () => {
  it('shows each booking with its time, party and notes, and the same named actions', () => {
    const onEdit = vi.fn();
    const { getByText, getAllByRole, getByRole } = render(<BookingCards reservations={reservations} onEdit={onEdit} onDelete={vi.fn()} />);
    expect(getByText('12:30')).toBeTruthy();
    expect(getByText('No nuts')).toBeTruthy();
    const davidCard = getByText('David Clark').closest<HTMLElement>('[data-booking-id]')!;
    expect(within(davidCard).getByText((_, el) => el?.tagName === 'SPAN' && /^1\sguest$/.test(el.textContent ?? ''))).toBeTruthy();
    expect(within(davidCard).queryByText('12:30')).toBeNull();
    expect(getAllByRole('button', { name: /Edit booking for/ })).toHaveLength(2);

    fireEvent.click(getByRole('button', { name: /Edit booking for David Clark/ }));
    expect(onEdit).toHaveBeenCalledWith(reservations[1]);
  });
});
