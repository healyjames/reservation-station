// @vitest-environment jsdom
import { render, within } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import type { AdminBlockedDate, AdminDateOverride } from '@shared/types';
import DayHoursBanner from './DayHoursBanner';

function makeBlock(overrides: Partial<AdminBlockedDate> = {}): AdminBlockedDate {
  return { id: 'block-1', date: '2099-12-24', start_time: '18:00', end_time: '22:00', reason: null, ...overrides };
}

describe('DayHoursBanner', () => {
  it('renders nothing on a day with no changed hours', () => {
    const { container } = render(<DayHoursBanner blocks={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('lists each changed time range with its reason', () => {
    const { getByRole } = render(
      <DayHoursBanner
        blocks={[makeBlock({ id: 'a', start_time: '12:00', end_time: '13:00' }), makeBlock({ id: 'b', reason: 'Closing early' })]}
      />,
    );

    const banner = getByRole('note', { name: /changed hours on this day/i });
    const items = within(banner).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('12:00 – 13:00');
    expect(items[1].textContent).toContain('18:00 – 22:00');
    expect(items[1].textContent).toContain('Closing early');
  });

  it('shows special opening hours, with or without blocked ranges', () => {
    const specialHours: AdminDateOverride = {
      id: 'o1',
      date: '2099-12-26',
      is_closed: 0,
      open_time: '12:00',
      close_time: '16:00',
      reason: 'Boxing Day',
    };
    const { getByRole, queryByRole } = render(<DayHoursBanner blocks={[]} specialHours={specialHours} />);

    const banner = getByRole('note', { name: /changed hours on this day/i });
    expect(banner.textContent).toContain('Special opening hours: 12:00 – 16:00');
    expect(banner.textContent).toContain('Boxing Day');
    expect(queryByRole('list')).toBeNull();
  });

  it('links to the specific-day hours from the banner', () => {
    const { getByRole } = render(<DayHoursBanner blocks={[makeBlock()]} />);

    const link = getByRole('link', { name: /change these hours/i });

    expect(link.getAttribute('href')).toBe('#/settings/opening-hours/specific-day');
  });
});
