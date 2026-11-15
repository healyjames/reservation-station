// @vitest-environment jsdom
import { render, within, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import type { AdminBlockedDate } from '@shared/types';
import DayHoursBanner from './DayHoursBanner';

function makeBlock(overrides: Partial<AdminBlockedDate> = {}): AdminBlockedDate {
  return { id: 'block-1', date: '2099-12-24', start_time: '18:00', end_time: '22:00', reason: null, ...overrides };
}

describe('DayHoursBanner', () => {
  it('renders nothing on a day with no changed hours', () => {
    const { container } = render(<DayHoursBanner blocks={[]} onGoSettings={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('lists each changed time range with its reason', () => {
    const { getByRole } = render(
      <DayHoursBanner
        blocks={[makeBlock({ id: 'a', start_time: '12:00', end_time: '13:00' }), makeBlock({ id: 'b', reason: 'Closing early' })]}
        onGoSettings={vi.fn()}
      />,
    );

    const banner = getByRole('note', { name: /changed hours on this day/i });
    const items = within(banner).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('12:00 – 13:00');
    expect(items[1].textContent).toContain('18:00 – 22:00');
    expect(items[1].textContent).toContain('Closing early');
  });

  it('takes the admin to the settings for these hours from the banner', () => {
    const onGoSettings = vi.fn();
    const { getByRole } = render(<DayHoursBanner blocks={[makeBlock()]} onGoSettings={onGoSettings} />);

    fireEvent.click(getByRole('button', { name: /change these hours/i }));

    expect(onGoSettings).toHaveBeenCalledTimes(1);
  });
});
