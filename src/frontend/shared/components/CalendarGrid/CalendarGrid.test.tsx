// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import CalendarGrid from './CalendarGrid';
import type { CalendarDate } from '@shared/types';

describe('CalendarGrid', () => {
  it('renders without throwing', () => {
    const { container } = render(<CalendarGrid year={2024} month={0} />);
    expect(container).toBeTruthy();
  });

  it('renders 31 day cells for January 2024', () => {
    const { container } = render(<CalendarGrid year={2024} month={0} />);
    // role="button" cells + role="gridcell" cells = all day cells
    const buttons = container.querySelectorAll('[role="button"]');
    const gridcells = container.querySelectorAll('[role="gridcell"]');
    expect(buttons.length + gridcells.length).toBe(31);
  });

  it('renders 0 leading empty cells for January 2024 (Jan 1 is Monday)', () => {
    const { container } = render(<CalendarGrid year={2024} month={0} />);
    // Empty cells have aria-hidden="true" and no day number content
    const empties = container.querySelectorAll('[aria-hidden="true"]');
    // Day name headers (7) also have no interaction — empties are additional
    // The grid has 7 column headers + 0 leading empties + 31 days = 38 children
    const gridChildren = container.firstElementChild?.children ?? [];
    // 7 day name headers + 0 empties + 31 day cells = 38
    expect(gridChildren.length).toBe(38);
  });

  it('renders correct leading empties for February 2024 (Feb 1 is Thursday = 3 empties)', () => {
    // Feb 1 2024 is Thursday: getDay()=4 → 4-1=3 empties
    const { container } = render(<CalendarGrid year={2024} month={1} />);
    const gridChildren = container.firstElementChild?.children ?? [];
    // 7 headers + 3 empties + 29 days (2024 is leap year) = 39
    expect(gridChildren.length).toBe(39);
  });

  it('calls onSelect with correct year/month/day when a future day is clicked', () => {
    const onSelect = vi.fn();
    // Use a far-future year so no day is "past"
    const { container } = render(<CalendarGrid year={2099} month={5} onSelect={onSelect} />);
    const firstButton = container.querySelector('[role="button"]') as HTMLElement;
    fireEvent.click(firstButton);
    expect(onSelect).toHaveBeenCalledWith(2099, 5, 1);
  });

  it('marks today with the today class', () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();

    const selectedDate: CalendarDate = { year, month, day };
    const { container } = render(<CalendarGrid year={year} month={month} selectedDate={selectedDate} />);

    // Find the cell that contains today's day number and verify today class
    const allCells = container.querySelectorAll('[role="button"], [role="gridcell"]');
    const todayCell = Array.from(allCells).find(el => el.textContent === String(day)) as HTMLElement | undefined;
    expect(todayCell).toBeTruthy();
    expect(todayCell!.className).toContain('today');
  });

  it('marks selected date cell with selected class', () => {
    const selectedDate: CalendarDate = { year: 2099, month: 5, day: 15 };
    const { container } = render(
      <CalendarGrid year={2099} month={5} selectedDate={selectedDate} />
    );
    const allButtons = container.querySelectorAll('[role="button"]');
    const selected = Array.from(allButtons).find(el => el.textContent === '15') as HTMLElement | undefined;
    expect(selected).toBeTruthy();
    expect(selected!.className).toContain('selected');
  });
});
