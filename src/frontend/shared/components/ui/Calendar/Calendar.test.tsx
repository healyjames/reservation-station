// @vitest-environment jsdom
import { fireEvent, render, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Calendar from './Calendar';

// "Today" is 15 June 2099 (a Monday), so past, today and future days are fixed.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2099, 5, 15, 12));
});
afterEach(() => vi.useRealTimers());

const dayCells = (grid: HTMLElement) => within(grid).queryAllByText(/^\d+$/);
const day = (grid: HTMLElement, n: number) => within(grid).getByText(String(n));

describe('Calendar', () => {
  it('is a grid named by month with Monday-first column headers', () => {
    const { getByRole } = render(<Calendar year={2024} month={0} />);
    const grid = getByRole('grid', { name: 'January 2024' });
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('renders every day of the month after the leading empties (hidden from assistive tech)', () => {
    // 1 Feb 2024 is a Thursday: 3 empties. 2024 is a leap year: 29 days.
    const { getByRole } = render(<Calendar year={2024} month={1} />);
    const grid = getByRole('grid');
    const children = Array.from(grid.children);
    const empties = children.slice(7, 10);
    expect(empties.every((el) => el.getAttribute('aria-hidden') === 'true' && el.textContent === '')).toBe(true);
    expect(children[10].textContent).toBe('1');
    expect(dayCells(grid)).toHaveLength(29);
  });

  it('has no leading empties when the 1st is a Monday', () => {
    const { getByRole } = render(<Calendar year={2024} month={0} />);
    expect(getByRole('grid').children[7].textContent).toBe('1');
  });

  it('has six leading empties when the 1st is a Sunday', () => {
    // 1 Sep 2024 is a Sunday.
    const { getByRole } = render(<Calendar year={2024} month={8} />);
    expect(getByRole('grid').children[13].textContent).toBe('1');
  });

  it('a future day is a button that selects on click, Enter and Space', () => {
    const onSelect = vi.fn();
    const { getByRole } = render(<Calendar year={2099} month={5} onSelect={onSelect} />);
    const cell = getByRole('button', { name: '20' });
    expect(cell.getAttribute('aria-pressed')).toBe('false');
    expect(cell.tabIndex).toBe(0);
    fireEvent.click(cell);
    fireEvent.keyDown(cell, { key: 'Enter' });
    fireEvent.keyDown(cell, { key: ' ' });
    fireEvent.keyDown(cell, { key: 'a' });
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenCalledWith(2099, 5, 20);
  });

  it('marks the selected day with aria-pressed and data-selected', () => {
    const { getByRole } = render(<Calendar year={2099} month={5} selectedDate={{ year: 2099, month: 5, day: 20 }} />);
    const selected = getByRole('button', { name: '20' });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(selected.hasAttribute('data-selected')).toBe(true);
    expect(getByRole('button', { name: '21' }).hasAttribute('data-selected')).toBe(false);
  });

  it('marks today with aria-current="date" and data-today, and a decorative dot', () => {
    const { getByRole } = render(<Calendar year={2099} month={5} />);
    const today = getByRole('button', { name: '15' });
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(today.hasAttribute('data-today')).toBe(true);
    expect(today.hasAttribute('data-past')).toBe(false);
    // The only element child is the decorative dot.
    expect(Array.from(today.children).map((el) => el.getAttribute('aria-hidden'))).toEqual(['true']);
    expect(getByRole('button', { name: '16' }).hasAttribute('aria-current')).toBe(false);
  });

  it('past days are disabled, unfocusable gridcells with data-past', () => {
    const onSelect = vi.fn();
    const { getByRole } = render(<Calendar year={2099} month={5} onSelect={onSelect} />);
    const past = day(getByRole('grid'), 14);
    expect(past.getAttribute('role')).toBe('gridcell');
    expect(past.getAttribute('aria-disabled')).toBe('true');
    expect(past.hasAttribute('tabindex')).toBe(false);
    expect(past.hasAttribute('data-past')).toBe(true);
    fireEvent.click(past);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('allowPastDates makes past days selectable', () => {
    const onSelect = vi.fn();
    const { getByRole } = render(<Calendar year={2099} month={5} allowPastDates onSelect={onSelect} />);
    const past = getByRole('button', { name: '14' });
    expect(past.hasAttribute('data-past')).toBe(true);
    fireEvent.click(past);
    expect(onSelect).toHaveBeenCalledWith(2099, 5, 14);
  });

  it('isDisabled makes a future day a plain disabled gridcell', () => {
    const { getByRole } = render(<Calendar year={2099} month={5} isDisabled={(_y, _m, d) => d === 20} />);
    const cell = day(getByRole('grid'), 20);
    expect(cell.getAttribute('role')).toBe('gridcell');
    expect(cell.getAttribute('aria-disabled')).toBe('true');
    expect(cell.hasAttribute('data-blocked')).toBe(false);
  });

  it('a disabled blocked day stays focusable and calls onBlockedSelect with its element on click, Enter and Space', () => {
    const onBlockedSelect = vi.fn();
    const onSelect = vi.fn();
    const blocked = (_y: number, _m: number, d: number) => d === 20;
    const { getByRole } = render(
      <Calendar year={2099} month={5} isDisabled={blocked} isBlocked={blocked} onSelect={onSelect} onBlockedSelect={onBlockedSelect} />,
    );
    const cell = day(getByRole('grid'), 20);
    expect(cell.getAttribute('role')).toBe('gridcell');
    expect(cell.getAttribute('aria-disabled')).toBe('true');
    expect(cell.tabIndex).toBe(0);
    expect(cell.hasAttribute('data-blocked')).toBe(true);
    fireEvent.click(cell);
    fireEvent.keyDown(cell, { key: 'Enter' });
    fireEvent.keyDown(cell, { key: ' ' });
    expect(onBlockedSelect).toHaveBeenCalledTimes(3);
    expect(onBlockedSelect).toHaveBeenCalledWith(2099, 5, 20, cell);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('a blocked day that is not disabled is still a selectable button (Blocked Dates toggling)', () => {
    const onSelect = vi.fn();
    const { getByRole } = render(<Calendar year={2099} month={5} isBlocked={(_y, _m, d) => d === 20} onSelect={onSelect} />);
    const cell = getByRole('button', { name: '20' });
    expect(cell.hasAttribute('data-blocked')).toBe(true);
    fireEvent.click(cell);
    expect(onSelect).toHaveBeenCalledWith(2099, 5, 20);
  });

  it('a blocked day that is not disabled does not call onBlockedSelect', () => {
    const onBlockedSelect = vi.fn();
    const { getByRole } = render(<Calendar year={2099} month={5} isBlocked={(_y, _m, d) => d === 20} onBlockedSelect={onBlockedSelect} />);
    fireEvent.click(getByRole('button', { name: '20' }));
    expect(onBlockedSelect).not.toHaveBeenCalled();
  });

  it('never marks a past day as blocked', () => {
    const { getByRole } = render(<Calendar year={2099} month={5} isBlocked={() => true} />);
    expect(day(getByRole('grid'), 14).hasAttribute('data-blocked')).toBe(false);
    expect(day(getByRole('grid'), 16).hasAttribute('data-blocked')).toBe(true);
  });

  it.each(['block', 'unblock'] as const)('exposes the %s range preview as data-range and data-range-mode', (rangeMode) => {
    const { getByRole } = render(
      <Calendar
        year={2099}
        month={5}
        rangeMode={rangeMode}
        isRangeStart={(_y, _m, d) => d === 20}
        isInRange={(_y, _m, d) => d === 21}
        isRangeEnd={(_y, _m, d) => d === 22}
      />,
    );
    const range = [20, 21, 22, 23].map((n) => getByRole('button', { name: String(n) }));
    expect(range.map((el) => el.getAttribute('data-range'))).toEqual(['start', 'middle', 'end', null]);
    expect(range.map((el) => el.getAttribute('data-range-mode'))).toEqual([rangeMode, rangeMode, rangeMode, null]);
  });

  it('gives a day one range value: start wins over end and middle', () => {
    const { getByRole } = render(
      <Calendar year={2099} month={5} isRangeStart={() => true} isInRange={() => true} isRangeEnd={(_y, _m, d) => d > 25} />,
    );
    expect(getByRole('button', { name: '26' }).getAttribute('data-range')).toBe('start');
  });

  it('gives a day one range value: end wins over middle', () => {
    const { getByRole } = render(<Calendar year={2099} month={6} isInRange={() => true} isRangeEnd={(_y, _m, d) => d === 1} />);
    expect(getByRole('button', { name: '1' }).getAttribute('data-range')).toBe('end');
    expect(getByRole('button', { name: '2' }).getAttribute('data-range')).toBe('middle');
  });

  it('does not report hovers on disabled days (Blocked Dates range preview)', () => {
    const onHoverDate = vi.fn();
    const blocked = (_y: number, _m: number, d: number) => d === 20;
    const { getByRole } = render(<Calendar year={2099} month={5} isDisabled={blocked} isBlocked={blocked} onHoverDate={onHoverDate} />);
    fireEvent.mouseEnter(day(getByRole('grid'), 20));
    fireEvent.mouseEnter(day(getByRole('grid'), 14));
    expect(onHoverDate).not.toHaveBeenCalled();
  });

  it('reports hovered days, and passes other attributes such as onMouseLeave to the grid', () => {
    const onHoverDate = vi.fn();
    const onMouseLeave = vi.fn();
    const { getByRole } = render(<Calendar year={2099} month={5} id="cal" onHoverDate={onHoverDate} onMouseLeave={onMouseLeave} />);
    fireEvent.mouseEnter(getByRole('button', { name: '20' }));
    expect(onHoverDate).toHaveBeenCalledWith(2099, 5, 20);
    const grid = getByRole('grid');
    expect(grid.id).toBe('cal');
    fireEvent.mouseLeave(grid);
    expect(onMouseLeave).toHaveBeenCalledOnce();
  });

  it('keeps its own role and month name', () => {
    // role and aria-label are not in the props type; the spread forces them, to prove Calendar keeps its own.
    const { getByRole } = render(<Calendar year={2099} month={5} {...{ role: 'table', 'aria-label': 'Other' }} />);
    expect(getByRole('grid', { name: 'June 2099' })).toBeTruthy();
  });
});
