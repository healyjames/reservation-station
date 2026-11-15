// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
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

  it('hides the "Selected Date" label when hideLabel is set', () => {
    const { queryByText } = render(<SelectedDateInfo date={testDate} hideLabel />);
    expect(queryByText('Selected Date')).toBeNull();
  });
});
