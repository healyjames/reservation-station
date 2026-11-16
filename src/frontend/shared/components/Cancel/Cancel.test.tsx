// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Reservation } from '@shared/types';
import { Error as ErrorView, Loading, Overview, Success } from '.';

const reservation: Reservation = {
  id: 'r1',
  tenant_id: 't1',
  first_name: 'Alex',
  surname: 'Guest',
  telephone: '01234567890',
  email: 'alex@example.com',
  reservation_date: '2099-06-20',
  reservation_time: '19:00',
  guests: 2,
};

describe('cancel booking views', () => {
  it('Loading names the page and announces loading', () => {
    const { getByRole } = render(<Loading />);
    expect(getByRole('heading', { level: 1, name: 'Cancel your booking' })).toBeTruthy();
    expect(getByRole('status').textContent).toBe('Loading your booking details');
  });

  it('Error shows the message under its own heading', () => {
    const { getByRole, getByText } = render(<ErrorView message="Link expired" />);
    expect(getByRole('heading', { level: 2, name: 'Unable to cancel booking' })).toBeTruthy();
    expect(getByText('Link expired')).toBeTruthy();
  });

  describe('Overview', () => {
    it('lists the booking and cancels it from the one action', () => {
      const onCancel = vi.fn();
      const { container, getAllByRole, getByText } = render(
        <Overview reservation={reservation} inlineError="" isCancelling={false} onCancel={onCancel} />,
      );
      expect(Array.from(container.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual(['Name', 'Date', 'Time', 'Party size']);
      expect(getByText('Alex Guest')).toBeTruthy();
      const buttons = getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual(['Cancel My Booking']);
      fireEvent.click(buttons[0]);
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('lists dietary requirements when there are some', () => {
      const { container } = render(
        <Overview
          reservation={{ ...reservation, dietary_requirements: ' No nuts ' }}
          inlineError=""
          isCancelling={false}
          onCancel={vi.fn()}
        />,
      );
      expect(Array.from(container.querySelectorAll('dt')).pop()?.textContent).toBe('Dietary requirements & special requests');
    });

    it('shows a busy, disabled button while cancelling', () => {
      const { getByRole } = render(<Overview reservation={reservation} inlineError="" isCancelling onCancel={vi.fn()} />);
      const button = getByRole('button', { name: 'Cancelling...' }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
    });

    it('announces an inline error', () => {
      const { getByRole } = render(
        <Overview reservation={reservation} inlineError="Already cancelled" isCancelling={false} onCancel={vi.fn()} />,
      );
      expect(getByRole('alert').textContent).toMatch(/something went wrong.*already cancelled/i);
    });
  });

  it('Success confirms the cancellation with no further actions', () => {
    const { getByRole, queryByRole, getByText } = render(<Success reservation={reservation} />);
    expect(getByRole('heading', { level: 2, name: 'Your booking has been cancelled.' })).toBeTruthy();
    expect(getByText('Alex Guest')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });
});
