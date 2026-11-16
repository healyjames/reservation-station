// @vitest-environment jsdom
import { act, fireEvent, render, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Calendar } from './Calendar';

// "Today" is 15 June 2099, so June is the current month and later days are selectable.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(2099, 5, 15, 12));
});
afterEach(() => vi.useRealTimers());

type Props = Parameters<typeof Calendar>[0];

function renderCalendar(overrides: Partial<Props> = {}) {
  const onMonthChange = vi.fn<Props['onMonthChange']>().mockResolvedValue(undefined);
  const onDateSelect = vi.fn<Props['onDateSelect']>().mockResolvedValue(undefined);
  const view = render(
    <Calendar
      year={2099}
      month={5}
      selectedDate={null}
      blockedDates={new Set()}
      onMonthChange={onMonthChange}
      onDateSelect={onDateSelect}
      {...overrides}
    />,
  );
  onMonthChange.mockClear(); // the initial load on mount
  return { ...view, onMonthChange, onDateSelect };
}

describe('BookingWidget Calendar', () => {
  it('is a region named by the month heading, with a grid for that month', () => {
    const { getByRole } = renderCalendar();
    const region = getByRole('region', { name: 'June 2099' });
    expect(within(region).getByRole('heading', { level: 2, name: 'June 2099' }).id).toBe('calendar-title');
    expect(within(region).getByRole('grid', { name: 'June 2099' })).toBeTruthy();
  });

  it('loads the shown month on mount', () => {
    const onMonthChange = vi.fn<Props['onMonthChange']>().mockResolvedValue(undefined);
    render(
      <Calendar year={2099} month={5} selectedDate={null} blockedDates={new Set()} onMonthChange={onMonthChange} onDateSelect={vi.fn()} />,
    );
    expect(onMonthChange).toHaveBeenCalledWith(2099, 5);
  });

  it('moves between months with the named Previous and Next month buttons, across the year boundary', () => {
    const { getByRole, onMonthChange, rerender } = renderCalendar({ year: 2099, month: 11 });
    fireEvent.click(getByRole('button', { name: 'Next month' }));
    expect(onMonthChange).toHaveBeenLastCalledWith(2100, 0);

    rerender(
      <Calendar year={2100} month={0} selectedDate={null} blockedDates={new Set()} onMonthChange={onMonthChange} onDateSelect={vi.fn()} />,
    );
    fireEvent.click(getByRole('button', { name: 'Previous month' }));
    expect(onMonthChange).toHaveBeenLastCalledWith(2099, 11);
  });

  it('disables Previous month on the current month unless past dates are allowed', () => {
    const { getByRole, rerender, onMonthChange } = renderCalendar();
    expect((getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <Calendar
        year={2099}
        month={5}
        selectedDate={null}
        blockedDates={new Set()}
        allowPastDates
        onMonthChange={onMonthChange}
        onDateSelect={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Previous month' }));
    expect(onMonthChange).toHaveBeenCalledWith(2099, 4);
  });

  it('disables both month buttons while dates are loading', () => {
    const { getByRole } = renderCalendar({ month: 6, isFetchingDates: true });
    expect((getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(true);
    expect((getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('selects an available day', () => {
    const { getByRole, onDateSelect } = renderCalendar();
    fireEvent.click(getByRole('button', { name: '20' }));
    expect(onDateSelect).toHaveBeenCalledWith(2099, 5, 20);
  });

  it('explains a tapped blocked date in a tooltip and a status message, then hides both after 3 seconds', () => {
    const { getByRole, getByText, queryByRole } = renderCalendar({ blockedDates: new Set(['2099-06-20']) });
    const blocked = getByRole('gridcell', { name: '20' });
    fireEvent.click(blocked);

    const message = /online bookings are no longer available for this date/i;
    const tooltip = getByRole('tooltip');
    expect(tooltip.textContent).toMatch(message);
    expect(blocked.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(getByRole('status').textContent).toMatch(message);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(queryByRole('tooltip')).toBeNull();
    expect(getByRole('status').textContent).toBe('');
  });

  it('says "Closed" for a tapped closed date, and closes the tip from its close button', () => {
    const { getByRole, getByText, queryByRole } = renderCalendar({ closedDates: new Set(['2099-06-21']) });
    fireEvent.keyDown(getByText('21'), { key: 'Enter' });
    expect(getByRole('tooltip').textContent).toMatch(/^Closed/);
    expect(getByRole('status').textContent).toBe('Closed');

    fireEvent.click(getByRole('button', { name: 'Close tooltip' }));
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('closes the tip and clears the status message when the month changes', () => {
    const { getByRole, queryByRole, rerender, onMonthChange } = renderCalendar({ blockedDates: new Set(['2099-06-20']) });
    fireEvent.click(getByRole('gridcell', { name: '20' }));
    expect(getByRole('tooltip')).toBeTruthy();

    rerender(
      <Calendar year={2099} month={6} selectedDate={null} blockedDates={new Set()} onMonthChange={onMonthChange} onDateSelect={vi.fn()} />,
    );
    expect(queryByRole('tooltip')).toBeNull();
    expect(getByRole('status').textContent).toBe('');
  });

  it('closes the tip on Esc', () => {
    const { getByRole, queryByRole } = renderCalendar({ blockedDates: new Set(['2099-06-20']) });
    fireEvent.click(getByRole('gridcell', { name: '20' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('announces a dates loading error with a Retry that reloads the month', () => {
    const { getByRole, onMonthChange } = renderCalendar({ month: 7, blockedDatesError: 'Could not load availability' });
    const alert = getByRole('alert');
    expect(alert.textContent).toMatch('Could not load availability');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onMonthChange).toHaveBeenCalledWith(2099, 7);
  });

  it('shows the welcome header with the venue name only when standalone', () => {
    const { queryByRole, rerender, onMonthChange } = renderCalendar();
    expect(queryByRole('heading', { level: 1 })).toBeNull();

    rerender(
      <Calendar
        year={2099}
        month={5}
        selectedDate={null}
        blockedDates={new Set()}
        isStandalone
        tenantName="The Red Cow"
        onMonthChange={onMonthChange}
        onDateSelect={vi.fn()}
      />,
    );
    expect(queryByRole('heading', { level: 1, name: 'The Red Cow Reservations' })).toBeTruthy();
  });

  it('falls back to a generic welcome title without a venue name', () => {
    const { getByRole } = renderCalendar({ isStandalone: true });
    expect(getByRole('heading', { level: 1, name: 'Make a Reservation' })).toBeTruthy();
  });
});
