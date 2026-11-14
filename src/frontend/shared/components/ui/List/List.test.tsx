// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import List from './List';

const ITEMS = [
  { term: 'Name', value: 'Ada Lovelace' },
  { term: 'Date', value: '2026-06-01' },
  { term: 'Guests', value: 2 },
];

const pairs = (container: Element) =>
  Array.from(container.querySelectorAll('dt')).map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);

describe('List', () => {
  it.each(['inline', 'stacked'] as const)('renders dt/dd pairs in order (%s)', (layout) => {
    const { container } = render(<List items={ITEMS} layout={layout} />);
    expect(pairs(container)).toEqual([
      ['Name', 'Ada Lovelace'],
      ['Date', '2026-06-01'],
      ['Guests', '2'],
    ]);
    container.querySelectorAll('dt').forEach((dt) => expect(dt.nextElementSibling?.tagName).toBe('DD'));
  });

  it('skips falsy items', () => {
    const telephone = '';
    const { container } = render(
      <List items={[{ term: 'Name', value: 'Ada' }, telephone && { term: 'Phone', value: telephone }, null, undefined]} />,
    );
    expect(pairs(container)).toEqual([['Name', 'Ada']]);
  });

  it('renders rich values', () => {
    const { getByText } = render(<List items={[{ term: 'Guests', value: <strong>4</strong> }]} />);
    expect(getByText('4').tagName).toBe('STRONG');
  });

  it('passes other attributes to the list', () => {
    const { container } = render(<List items={ITEMS} id="booking-details" aria-label="Booking details" />);
    const dl = container.querySelector('dl');
    expect(dl?.id).toBe('booking-details');
    expect(dl?.getAttribute('aria-label')).toBe('Booking details');
  });
});
