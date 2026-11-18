// @vitest-environment jsdom
import { fireEvent, render, within } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
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

describe('List rows', () => {
  const ROWS = [
    { key: 'a', content: '18:00 – 19:00', action: <button type="button">Remove 18:00 to 19:00</button> },
    { key: 'b', content: '21:00 – 22:00 Private party' },
  ];

  it('renders a named list with one item per row, in order', () => {
    const { getByRole } = render(<List rows={ROWS} aria-label="Blocked time ranges" />);
    const items = within(getByRole('list', { name: 'Blocked time ranges' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['18:00 – 19:00Remove 18:00 to 19:00', '21:00 – 22:00 Private party']);
  });

  it('puts the action in its row, found by its name', () => {
    const onRemove = vi.fn();
    const { getAllByRole } = render(
      <List rows={[{ key: 'a', content: '18:00 – 19:00', action: <button onClick={onRemove}>Remove 18:00 to 19:00</button> }]} />,
    );
    const [row] = getAllByRole('listitem');
    fireEvent.click(within(row).getByRole('button', { name: 'Remove 18:00 to 19:00' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('renders a row without an action as just its content', () => {
    const { getAllByRole } = render(<List rows={ROWS} />);
    expect(within(getAllByRole('listitem')[1]).queryByRole('button')).toBeNull();
  });

  it('skips falsy rows', () => {
    const reason = '';
    const { getAllByRole } = render(<List rows={[ROWS[0], reason && { key: 'r', content: reason }, null]} />);
    expect(getAllByRole('listitem')).toHaveLength(1);
  });

  it('sets an explicit list role, which Safari drops from unmarked lists', () => {
    const { getByRole } = render(<List rows={ROWS} />);
    expect(getByRole('list').getAttribute('role')).toBe('list');
  });
});
