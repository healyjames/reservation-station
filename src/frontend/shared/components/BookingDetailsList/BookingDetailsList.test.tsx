// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import BookingDetailsList from './BookingDetailsList';

const DETAILS = [
  { label: 'Name', value: 'James Healy' },
  { label: 'Date', value: '2026-06-01' },
  { label: 'Guests', value: 2 },
];

describe('BookingDetailsList', () => {
  it('renders without throwing', () => {
    const { container } = render(<BookingDetailsList details={DETAILS} />);
    expect(container.querySelector('dl')).toBeTruthy();
  });

  it('renders correct number of detail rows', () => {
    const { container } = render(<BookingDetailsList details={DETAILS} />);
    expect(container.querySelectorAll('.detail-row').length).toBe(3);
  });

  it('renders labels and values', () => {
    const { getByText } = render(<BookingDetailsList details={DETAILS} />);
    expect(getByText('Name')).toBeTruthy();
    expect(getByText('James Healy')).toBeTruthy();
  });
});
