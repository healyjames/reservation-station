// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFetch } from '@shared/utils/adminFetch';
import BlockedDatesSettings from './BlockedDatesSettings';

vi.mock('@shared/utils/adminFetch', () => ({
  adminFetch: vi.fn(),
}));

type AdminBlockedDateRow = {
  date: string;
  start_time: string | null;
};

const adminFetchMock = vi.mocked(adminFetch);

function makeResponse<T>(body: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('BlockedDatesSettings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-06-05T12:00:00.000Z'));
    adminFetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('unblocks only blocked days when a blocked range is selected', async () => {
    const blockedRows: AdminBlockedDateRow[] = [
      { date: '2099-06-10', start_time: null },
      { date: '2099-06-11', start_time: null },
    ];

    adminFetchMock
      .mockResolvedValueOnce(makeResponse(blockedRows))
      .mockResolvedValueOnce(makeResponse({ success: true }))
      .mockResolvedValueOnce(makeResponse({ success: true }));

    const { getByRole, getByText } = render(<BlockedDatesSettings token="token-123" />);

    await waitFor(() => {
      expect(getByRole('button', { name: '10' }).dataset.blocked).toBe('true');
    });

    expect(getByText('Click to toggle · Click two days to block or unblock a range')).toBeTruthy();

    const day10 = getByRole('button', { name: '10' }) as HTMLElement;
    const day11 = getByRole('button', { name: '11' }) as HTMLElement;
    const day12 = getByRole('button', { name: '12' }) as HTMLElement;

    fireEvent.click(day10);

    await waitFor(() => {
      expect([day10.dataset.range, day10.dataset.rangeMode]).toEqual(['start', 'unblock']);
    });

    fireEvent.mouseEnter(day12);

    expect([day11.dataset.range, day11.dataset.rangeMode]).toEqual(['middle', 'unblock']);
    expect([day12.dataset.range, day12.dataset.rangeMode]).toEqual(['end', 'unblock']);

    fireEvent.click(day12);

    await waitFor(() => {
      expect(adminFetchMock).toHaveBeenCalledTimes(3);
    });

    expect(adminFetchMock.mock.calls[1]).toEqual(['/api/admin/blocked-dates/date/2099-06-10', 'token-123', { method: 'DELETE' }]);
    expect(adminFetchMock.mock.calls[2]).toEqual(['/api/admin/blocked-dates/date/2099-06-11', 'token-123', { method: 'DELETE' }]);
    expect(adminFetchMock.mock.calls.some(([, , options]) => options?.method === 'POST')).toBe(false);

    await waitFor(() => {
      expect(getByRole('button', { name: '10' }).dataset.blocked).toBeUndefined();
      expect(getByRole('button', { name: '11' }).dataset.blocked).toBeUndefined();
    });
  });

  it('blocks a range in block mode, skipping days already blocked', async () => {
    adminFetchMock.mockImplementation(async (url, _token, options) =>
      options?.method === 'POST'
        ? makeResponse({ success: true }, 201)
        : makeResponse(url.includes('?month=') ? [{ date: '2099-06-21', start_time: null }] : {}),
    );
    const { getByRole } = render(<BlockedDatesSettings token="token-123" />);
    await waitFor(() => expect(getByRole('button', { name: '21' }).dataset.blocked).toBe('true'));

    fireEvent.click(getByRole('button', { name: '20' }));
    fireEvent.mouseEnter(getByRole('button', { name: '22' }));
    expect(getByRole('button', { name: '20' }).dataset.rangeMode).toBe('block');
    fireEvent.click(getByRole('button', { name: '22' }));

    await waitFor(() => expect(getByRole('button', { name: '22' }).dataset.blocked).toBe('true'));
    const posted = adminFetchMock.mock.calls.filter(([, , options]) => options?.method === 'POST').map(([, , options]) => options?.body);
    expect(posted).toEqual([JSON.stringify({ date: '2099-06-20' }), JSON.stringify({ date: '2099-06-22' })]);
  });

  it('clears the range preview when the pointer leaves the calendar', async () => {
    adminFetchMock.mockResolvedValue(makeResponse([]));
    const { getByRole } = render(<BlockedDatesSettings token="token-123" />);
    await waitFor(() => expect(getByRole('button', { name: '20' })).toBeTruthy());

    fireEvent.click(getByRole('button', { name: '20' }));
    fireEvent.mouseEnter(getByRole('button', { name: '22' }));
    expect(getByRole('button', { name: '21' }).dataset.range).toBe('middle');
    fireEvent.mouseLeave(getByRole('grid', { name: 'June 2099' }));
    expect(getByRole('button', { name: '21' }).dataset.range).toBeUndefined();
    expect(getByRole('button', { name: '20' }).dataset.range).toBe('start');
  });

  it('moves between months from named buttons, but not before this month or onto past days', async () => {
    adminFetchMock.mockResolvedValue(makeResponse([]));
    const { getByRole, findByRole, queryByRole } = render(<BlockedDatesSettings token="token-123" />);
    expect(getByRole('heading', { level: 2, name: 'June 2099' })).toBeTruthy();
    expect((getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(true);
    // Past days cannot be blocked: they are disabled cells, not buttons.
    expect(queryByRole('button', { name: '4' })).toBeNull();
    expect(getByRole('gridcell', { name: '4' }).getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(getByRole('button', { name: 'Next month' }));

    expect(await findByRole('grid', { name: 'July 2099' })).toBeTruthy();
    expect(adminFetchMock).toHaveBeenLastCalledWith('/api/admin/blocked-dates?month=2099-07', 'token-123');
    expect((getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('announces a failed load', async () => {
    adminFetchMock.mockResolvedValue(makeResponse({}, 500));
    const { findByRole } = render(<BlockedDatesSettings token="token-123" />);
    expect((await findByRole('alert')).textContent).toBe('Failed to load blocked dates.');
  });
});
