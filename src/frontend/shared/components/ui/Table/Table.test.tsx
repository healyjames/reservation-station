// @vitest-environment jsdom
import { render, within } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Table from './Table';

const rows = (
  <>
    <thead>
      <tr>
        <th scope="col">Time</th>
        <th scope="col">Name</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>19:30</td>
        <td>Ada Lovelace</td>
      </tr>
    </tbody>
  </>
);

describe('Table', () => {
  it('is named by its caption', () => {
    const { getByRole } = render(<Table caption="Bookings for Mon 1 June">{rows}</Table>);
    expect(getByRole('table', { name: 'Bookings for Mon 1 June' })).toBeTruthy();
  });

  it('keeps the name when the caption is visually hidden', () => {
    const { getByRole } = render(
      <Table caption="Opening hours" hideCaption>
        {rows}
      </Table>,
    );
    expect(getByRole('table', { name: 'Opening hours' })).toBeTruthy();
  });

  it('keeps native table semantics', () => {
    const { getByRole } = render(<Table caption="Bookings">{rows}</Table>);
    const table = getByRole('table', { name: 'Bookings' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Time', 'Name']);
    expect(within(table).getByRole('cell', { name: 'Ada Lovelace' })).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });

  it('renders no caption without one', () => {
    const { container } = render(<Table aria-label="Bookings">{rows}</Table>);
    expect(container.querySelector('caption')).toBeNull();
  });

  it('passes other attributes to the table', () => {
    const { getByRole } = render(
      <Table caption="Bookings" id="bookings-table" aria-busy="true">
        {rows}
      </Table>,
    );
    const table = getByRole('table', { name: 'Bookings' });
    expect(table.id).toBe('bookings-table');
    expect(table.getAttribute('aria-busy')).toBe('true');
  });
});
