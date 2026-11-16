// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Success } from './Success';
import type { BookingFormData } from '@shared/types';

const formData: BookingFormData = {
  guests: 1,
  time: '19:30',
  firstName: 'Alex',
  surname: 'Guest',
  email: 'alex@example.com',
  telephone: '01234567890',
  dietary: '',
};

describe('Success', () => {
  it('confirms the booking under a heading with the party, date, time and email', () => {
    const { getByRole, container } = render(
      <Success formData={formData} selectedDate={{ year: 2099, month: 5, day: 15 }} onNewBooking={vi.fn()} />,
    );
    expect(getByRole('heading', { level: 2, name: 'Booking Confirmed!' })).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text).toMatch('1 guest on');
    expect(text).toMatch('15 June 2099');
    expect(text).toMatch('19:30');
    expect(text).toMatch('alex@example.com');
  });

  it('starts a new booking from "Book Another Table"', () => {
    const onNewBooking = vi.fn();
    const { getByRole } = render(
      <Success formData={{ ...formData, guests: 3 }} selectedDate={{ year: 2099, month: 5, day: 15 }} onNewBooking={onNewBooking} />,
    );
    fireEvent.click(getByRole('button', { name: 'Book Another Table' }));
    expect(onNewBooking).toHaveBeenCalledOnce();
  });
});
