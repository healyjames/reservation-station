// @vitest-environment jsdom
import { render, within, fireEvent, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminBlockedDate, OpeningHoursEntry } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import { changeSelect } from '@shared/mock/changeSelect';
import SpecificDayHours from './SpecificDayHours';

vi.mock('@shared/utils/adminFetch', () => ({
  adminFetch: vi.fn(),
}));

const adminFetchMock = vi.mocked(adminFetch);

function makeResponse<T>(body: T, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function makeBlock(overrides: Partial<AdminBlockedDate> = {}): AdminBlockedDate {
  return { id: 'block-1', date: '2099-06-10', start_time: '18:00', end_time: '20:00', reason: null, ...overrides };
}

// Open 12:00–22:00 every day except Monday (day_of_week 1), which is closed. 2099-06-08 is a Monday.
const HOURS: OpeningHoursEntry[] = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
  id: `h-${dow}`,
  tenant_id: 't',
  day_of_week: dow,
  is_closed: dow === 1 ? 1 : 0,
  open_time: dow === 1 ? null : '12:00',
  close_time: dow === 1 ? null : '22:00',
}));

type Handlers = {
  month?: (month: string) => Response;
  post?: (body: Record<string, unknown>) => Response;
  remove?: (id: string) => Response;
};

/** Routes the component's admin API calls and records the writes it makes. */
function mockApi({ month = () => makeResponse([]), post, remove }: Handlers = {}) {
  const writes: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  adminFetchMock.mockImplementation(async (url, _token, options) => {
    const method = options?.method ?? 'GET';
    if (url === '/api/admin/opening-hours') return makeResponse({ success: true, data: HOURS });
    if (method === 'GET') return month(url.split('month=')[1]);

    const body = options?.body ? (JSON.parse(options.body as string) as Record<string, unknown>) : undefined;
    writes.push({ url, method, body });
    if (method === 'POST') return post ? post(body ?? {}) : makeResponse(makeBlock({ id: 'created', ...body }), 201);
    return remove ? remove(url.split('/').pop() ?? '') : makeResponse({ success: true });
  });
  return writes;
}

async function renderLoaded(handlers: Handlers = {}) {
  const writes = mockApi(handlers);
  const onBack = vi.fn();
  const view = render(<SpecificDayHours token="token-123" onBack={onBack} />);
  await waitFor(() => expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/blocked-dates?month=2099-06', 'token-123'));
  await waitFor(() => expect(view.getByRole('button', { name: '10' })).toBeTruthy());
  return { ...view, writes, onBack };
}

describe('SpecificDayHours', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2099-06-05T12:00:00.000Z'));
    adminFetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for a day before showing the form', async () => {
    const { getByText, queryByLabelText } = await renderLoaded();

    expect(getByText(/select a day on the calendar/i)).toBeTruthy();
    expect(queryByLabelText('From')).toBeNull();
  });

  it('shows the form for the selected day, bounded by that day’s opening hours', async () => {
    const { getByRole, findByLabelText, getByText } = await renderLoaded();

    fireEvent.click(getByRole('button', { name: '10' }));

    const start = (await findByLabelText('From')) as HTMLSelectElement;
    const options = within(start)
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);
    expect(options[0]).toBe('12:00');
    expect(options[options.length - 1]).toBe('21:30');
    expect(getByText('Wednesday, 10 June 2099')).toBeTruthy();
  });

  it('posts a range for the selected day and lists it without reloading the month', async () => {
    const { getByRole, findByLabelText, getByLabelText, writes, findByRole } = await renderLoaded();
    fireEvent.click(getByRole('button', { name: '10' }));

    changeSelect((await findByLabelText('From')) as HTMLSelectElement, '18:00');
    await waitFor(() => expect((getByLabelText('Until') as HTMLSelectElement).disabled).toBe(false));
    changeSelect(getByLabelText('Until') as HTMLSelectElement, '22:00');
    fireEvent.input(getByLabelText(/reason/i), { target: { value: ' Closing early ' } });
    await waitFor(() => expect((getByRole('button', { name: /block time range/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(getByRole('button', { name: /block time range/i }));

    const monthList = await findByRole('list', { name: /changed hours in june 2099/i });
    expect(writes).toEqual([
      {
        url: '/api/admin/blocked-dates',
        method: 'POST',
        body: { date: '2099-06-10', start_time: '18:00', end_time: '22:00', reason: 'Closing early' },
      },
    ]);
    expect(within(monthList).getAllByRole('listitem')).toHaveLength(1);
    expect(monthList.textContent).toContain('18:00 – 22:00');
    expect(adminFetchMock.mock.calls.filter(([url]) => url.includes('month=')).length).toBe(1);
  });

  it('lists the month’s time ranges in date order and leaves full-day blocks out', async () => {
    const { findByRole } = await renderLoaded({
      month: () =>
        makeResponse([
          makeBlock({ id: 'late', date: '2099-06-20', start_time: '12:00', end_time: '13:00' }),
          makeBlock({ id: 'full-day', date: '2099-06-12', start_time: null, end_time: null }),
          makeBlock({ id: 'early', date: '2099-06-10', reason: 'Private party' }),
        ]),
    });

    const items = within(await findByRole('list', { name: /changed hours in june 2099/i })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('10 June 2099');
    expect(items[0].textContent).toContain('Private party');
    expect(items[1].textContent).toContain('20 June 2099');
  });

  it('removes a range by id and drops it from the list', async () => {
    const { findByRole, getByText, writes } = await renderLoaded({ month: () => makeResponse([makeBlock({ id: 'evening' })]) });

    fireEvent.click(await findByRole('button', { name: /remove 18:00 to 20:00 on wednesday, 10 june 2099/i }));

    await waitFor(() => expect(getByText(/no days have changed hours this month/i)).toBeTruthy());
    expect(writes).toEqual([{ url: '/api/admin/blocked-dates/evening', method: 'DELETE', body: undefined }]);
  });

  it('keeps the range and shows an error when removing fails', async () => {
    const { findByRole, getByRole } = await renderLoaded({
      month: () => makeResponse([makeBlock({ id: 'evening' })]),
      remove: () => makeResponse({ error: 'boom' }, 500),
    });

    fireEvent.click(await findByRole('button', { name: /remove 18:00 to 20:00/i }));

    await waitFor(() => expect(getByRole('alert').textContent).toMatch(/could not update the hours/i));
    expect(within(getByRole('list', { name: /changed hours in june 2099/i })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows an error and adds nothing when saving a range fails', async () => {
    const { getByRole, findByLabelText, getByLabelText, getByText } = await renderLoaded({
      post: () => makeResponse({ error: 'bad' }, 400),
    });
    fireEvent.click(getByRole('button', { name: '10' }));

    changeSelect((await findByLabelText('From')) as HTMLSelectElement, '18:00');
    await waitFor(() => expect((getByLabelText('Until') as HTMLSelectElement).disabled).toBe(false));
    changeSelect(getByLabelText('Until') as HTMLSelectElement, '22:00');
    await waitFor(() => expect((getByRole('button', { name: /block time range/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(getByRole('button', { name: /block time range/i }));

    await waitFor(() => expect(getByRole('alert').textContent).toMatch(/could not update the hours/i));
    expect(getByText(/no days have changed hours this month/i)).toBeTruthy();
  });

  it('does not open the form for a day the venue is closed', async () => {
    const { getByRole, queryByLabelText, getByText } = await renderLoaded();

    // A closed day is rendered as a disabled grid cell, not a selectable button.
    const closedDay = await waitFor(() => getByRole('gridcell', { name: '8' }));
    fireEvent.click(closedDay);

    expect(closedDay.getAttribute('aria-disabled')).toBe('true');
    expect(queryByLabelText('From')).toBeNull();
    expect(getByText(/select a day on the calendar/i)).toBeTruthy();
  });

  it('loads the next month when the calendar moves on', async () => {
    const { getByRole, findByText } = await renderLoaded({
      month: (month) => makeResponse(month === '2099-07' ? [makeBlock({ id: 'july', date: '2099-07-04' })] : []),
    });

    fireEvent.click(getByRole('button', { name: /next month/i }));

    expect(await findByText(/changed hours in july 2099/i)).toBeTruthy();
    await waitFor(() => expect(getByRole('list', { name: /changed hours in july 2099/i }).textContent).toContain('4 July 2099'));
  });

  it('offers a retry when the month cannot be loaded', async () => {
    mockApi({ month: () => makeResponse({ error: 'boom' }, 500) });
    const { findByRole } = render(<SpecificDayHours token="token-123" onBack={vi.fn()} />);

    expect((await findByRole('alert')).textContent).toMatch(/could not load this month/i);
    expect(await findByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('goes back to the weekly opening hours', async () => {
    const { getByRole, onBack } = await renderLoaded();

    fireEvent.click(getByRole('button', { name: /back to opening hours/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
