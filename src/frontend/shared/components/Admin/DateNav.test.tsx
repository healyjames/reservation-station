// @vitest-environment jsdom
import { fireEvent, render, within } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DateNav from './DateNav';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2099, 5, 15, 12));
});
afterEach(() => vi.useRealTimers());

function renderNav(date: Date, guestCount = 9) {
  const handlers = { onPrev: vi.fn(), onNext: vi.fn(), onOpenCalendar: vi.fn() };
  return { ...render(<DateNav currentDate={signal(date)} guestCount={guestCount} {...handlers} />), ...handlers };
}

describe('DateNav', () => {
  it('moves a day either way from named buttons', () => {
    const { getByRole, onPrev, onNext } = renderNav(new Date(2099, 5, 15));
    fireEvent.click(getByRole('button', { name: 'Previous day' }));
    fireEvent.click(getByRole('button', { name: 'Next day' }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('opens the date picker from the date, whose name starts with the visible date', () => {
    const { getByRole, onOpenCalendar } = renderNav(new Date(2099, 5, 16));
    const date = getByRole('button', { name: /^Tue 16 June, choose a date$/ });
    expect(date.id).toBe('current-date-display');
    fireEvent.click(date);
    expect(onOpenCalendar).toHaveBeenCalledOnce();
  });

  it('marks today, with Today before the hint in its name', () => {
    const { getByRole } = renderNav(new Date(2099, 5, 15));
    expect(getByRole('button', { name: /^Mon 15 June\s*Today, choose a date$/ })).toBeTruthy();
  });

  it('names the group of day controls', () => {
    expect(renderNav(new Date(2099, 5, 15)).getByRole('group', { name: 'Day' })).toBeTruthy();
  });

  it('does not mark another day as today', () => {
    expect(renderNav(new Date(2099, 5, 16)).queryByText('Today')).toBeNull();
  });

  it("shows the day's covers", () => {
    const { container } = renderNav(new Date(2099, 5, 15), 12);
    const stat = container.querySelector<HTMLElement>('#summary-text')!;
    expect(within(stat).getByText('Covers')).toBeTruthy();
    expect(within(stat).getByText('12')).toBeTruthy();
  });
});
