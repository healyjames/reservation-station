// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import SelectedDateInfo from './SelectedDateInfo';
import type { CalendarDate } from '@shared/types';

const testDate: CalendarDate = { year: 2024, month: 0, day: 15 }; // 15 January 2024

describe('SelectedDateInfo', () => {
  it('renders without throwing', () => {
    const { container } = render(<SelectedDateInfo date={testDate} />);
    expect(container).toBeTruthy();
  });

  it('displays the formatted date', () => {
    const { getByText } = render(<SelectedDateInfo date={testDate} />);
    // formatDateForDisplay produces "Monday, 15 January 2024"
    expect(getByText(/15 January 2024/)).toBeTruthy();
  });

  it('does NOT render "Change date" button when onChangeDate is absent', () => {
    const { queryByText } = render(<SelectedDateInfo date={testDate} />);
    expect(queryByText('Change date')).toBeNull();
  });

  it('renders "Change date" button when onChangeDate is provided', () => {
    const { getByText } = render(<SelectedDateInfo date={testDate} onChangeDate={() => {}} />);
    expect(getByText('Change date')).toBeTruthy();
  });

  it('calls onChangeDate when "Change date" is clicked', () => {
    const onChangeDate = vi.fn();
    const { getByText } = render(<SelectedDateInfo date={testDate} onChangeDate={onChangeDate} />);
    fireEvent.click(getByText('Change date'));
    expect(onChangeDate).toHaveBeenCalledOnce();
  });
});
