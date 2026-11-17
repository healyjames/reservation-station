// @vitest-environment jsdom
import { render, fireEvent, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFetch } from '@shared/utils/adminFetch';
import { useState } from 'preact/hooks';
import OpeningHoursSettings, { type OpeningHoursView } from './OpeningHoursSettings';

vi.mock('@shared/utils/adminFetch', () => ({
  adminFetch: vi.fn(),
}));

const adminFetchMock = vi.mocked(adminFetch);

/** Plays the admin router: holds the view the component asks for, as the URL hash does in the app. */
function Routed({ initial = 'weekly' }: { initial?: OpeningHoursView }) {
  const [view, setView] = useState<OpeningHoursView>(initial);
  return <OpeningHoursSettings token="token-123" view={view} onViewChange={setView} />;
}

function makeResponse<T>(body: T, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('OpeningHoursSettings', () => {
  let monthRows: Array<Record<string, unknown>>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2099-06-05T12:00:00.000Z'));
    monthRows = [];
    adminFetchMock.mockReset();
    adminFetchMock.mockImplementation(async (url, _token, options) => {
      if (url === '/api/admin/opening-hours') return makeResponse({ success: true, data: [] });
      if (options?.method === 'DELETE') {
        monthRows = monthRows.filter((row) => !url.endsWith(`/${row.id}`));
        return makeResponse({ success: true });
      }
      return makeResponse(monthRows);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists this month's changed hours under the specific-day prompt and removes one", async () => {
    monthRows = [
      { id: 'evening', date: '2099-06-10', start_time: '18:00', end_time: '20:00', reason: 'Private party' },
      { id: 'full-day', date: '2099-06-12', start_time: null, end_time: null, reason: null },
    ];
    const { findByRole, getByText } = render(<Routed />);

    const list = await findByRole('list', { name: /changed hours in june 2099/i });
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/blocked-dates?month=2099-06', 'token-123');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('18:00 – 20:00');
    expect(items[0].textContent).toContain('Private party');

    fireEvent.click(within(list).getByRole('button', { name: /remove 18:00 to 20:00/i }));

    await waitFor(() => expect(getByText(/no days have changed hours this month/i)).toBeTruthy());
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/blocked-dates/evening', 'token-123', { method: 'DELETE' });
  });

  it('reloads the changed hours when coming back from the specific-day view', async () => {
    const { findByRole, getByRole, findByText } = render(<Routed />);
    expect(await findByText(/no days have changed hours this month/i)).toBeTruthy();

    fireEvent.click(getByRole('button', { name: /change hours for a specific day/i }));
    await findByRole('heading', { name: /change hours on a specific day/i });
    monthRows = [{ id: 'new', date: '2099-06-20', start_time: '12:00', end_time: '13:00', reason: null }];
    fireEvent.click(getByRole('button', { name: /back to opening hours/i }));

    const list = await findByRole('list', { name: /changed hours in june 2099/i });
    expect(list.textContent).toContain('12:00 – 13:00');
  });

  it('shows the weekly schedule with a prompt to change hours on a specific day', async () => {
    const { findByRole, getByText } = render(<Routed />);

    expect(await findByRole('button', { name: /change hours for a specific day/i })).toBeTruthy();
    expect(getByText(/need different hours on a specific day/i)).toBeTruthy();
    expect(getByText('Save Changes')).toBeTruthy();
  });

  it('can open straight on the specific-day view', async () => {
    const { findByRole, queryByText } = render(<Routed initial="specific-day" />);

    expect(await findByRole('heading', { name: /change hours on a specific day/i })).toBeTruthy();
    expect(queryByText('Save Changes')).toBeNull();
  });

  it('swaps the weekly schedule for the specific-day view, and back again', async () => {
    const { findByRole, queryByText, getByRole } = render(<Routed />);

    fireEvent.click(await findByRole('button', { name: /change hours for a specific day/i }));

    expect(await findByRole('heading', { name: /change hours on a specific day/i })).toBeTruthy();
    expect(queryByText('Save Changes')).toBeNull();

    fireEvent.click(getByRole('button', { name: /back to opening hours/i }));

    expect(await findByRole('button', { name: /change hours for a specific day/i })).toBeTruthy();
    expect(queryByText('Save Changes')).not.toBeNull();
  });

  it('asks for the specific-day view instead of switching by itself', async () => {
    const onViewChange = vi.fn();
    const { findByRole, queryByRole } = render(<OpeningHoursSettings token="token-123" onViewChange={onViewChange} />);

    fireEvent.click(await findByRole('button', { name: /change hours for a specific day/i }));

    expect(onViewChange).toHaveBeenCalledWith('specific-day');
    expect(queryByRole('heading', { name: /change hours on a specific day/i })).toBeNull();
  });
});
