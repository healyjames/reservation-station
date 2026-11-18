// @vitest-environment jsdom
import { act, render, fireEvent, waitFor, within } from '@testing-library/preact';
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

  describe('weekly schedule', () => {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    it('names every time input and Closed switch with its day, in the table and in the cards', async () => {
      const { findByRole, getAllByLabelText, getAllByRole } = render(<Routed />);
      const table = await findByRole('table', { name: 'Weekly opening hours' });

      for (const day of DAYS) {
        for (const name of [`${day} start time`, `${day} end time`, `Closed on ${day}`]) {
          const controls = getAllByLabelText(name);
          expect(controls, name).toHaveLength(2);
          expect(
            controls.filter((control) => table.contains(control)),
            name,
          ).toHaveLength(1);
        }
      }
      expect(getAllByRole('checkbox')).toHaveLength(14);
    });

    it("disables a closed day's times in both layouts", async () => {
      const { findByRole, getAllByLabelText } = render(<Routed />);
      await findByRole('table', { name: 'Weekly opening hours' });
      fireEvent.click(getAllByLabelText('Closed on Monday')[0]);
      const times = [...getAllByLabelText('Monday start time'), ...getAllByLabelText('Monday end time')] as HTMLInputElement[];
      expect(times.map((input) => input.disabled)).toEqual([true, true, true, true]);
      expect((getAllByLabelText('Tuesday start time')[0] as HTMLInputElement).disabled).toBe(false);
    });

    it('saves the edited week and announces it', async () => {
      const { findByRole, getAllByLabelText, getByRole } = render(<Routed />);
      await findByRole('table', { name: 'Weekly opening hours' });
      fireEvent.input(getAllByLabelText('Friday end time')[0], { target: { value: '23:30' } });
      fireEvent.click(getAllByLabelText('Closed on Sunday')[1]);

      await act(async () => {
        fireEvent.click(getByRole('button', { name: 'Save Changes' }));
      });

      const put = adminFetchMock.mock.calls.find(([, , options]) => options?.method === 'PUT')!;
      const body = JSON.parse(put[2]!.body as string) as Array<Record<string, unknown>>;
      expect(body.find((day) => day.day_of_week === 5)).toMatchObject({ is_closed: false, close_time: '23:30' });
      expect(body.find((day) => day.day_of_week === 0)).toMatchObject({ is_closed: true, open_time: null, close_time: null });
      expect((await findByRole('status')).textContent).toBe('Opening hours saved.');
    });

    it('announces a failed load', async () => {
      adminFetchMock.mockImplementation(async (url) => (url === '/api/admin/opening-hours' ? makeResponse({}, 500) : makeResponse([])));
      const { findByRole } = render(<Routed />);
      expect((await findByRole('alert')).textContent).toBe('Failed to load opening hours.');
    });

    it('leaves the page title to the layout and gives each section an h2', async () => {
      const { findByRole, getAllByRole, getByRole } = render(<Routed />);
      await findByRole('table', { name: 'Weekly opening hours' });
      expect(getAllByRole('heading').map((h) => [h.tagName, h.textContent])).toEqual([
        ['H2', 'Need different hours on a specific day?'],
        ['H2', 'Changed hours in June 2099'],
      ]);
      expect(getByRole('region', { name: 'Need different hours on a specific day?' })).toBeTruthy();
      expect(getByRole('region', { name: 'Changed hours in June 2099' })).toBeTruthy();
    });
  });
});
