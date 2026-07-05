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
      expect(getByRole('button', { name: '10' }).className).toContain('blocked');
    });

    expect(getByText('Click to toggle · Click two days to block or unblock a range')).toBeTruthy();

    const day10 = getByRole('button', { name: '10' }) as HTMLElement;
    const day11 = getByRole('button', { name: '11' }) as HTMLElement;
    const day12 = getByRole('button', { name: '12' }) as HTMLElement;

    fireEvent.click(day10);

    await waitFor(() => {
      expect(day10.className).toContain('rangeStartUnblock');
    });

    fireEvent.mouseEnter(day12);

    expect(day11.className).toContain('inRangeUnblock');
    expect(day12.className).toContain('rangeEndUnblock');

    fireEvent.click(day12);

    await waitFor(() => {
      expect(adminFetchMock).toHaveBeenCalledTimes(3);
    });

    expect(adminFetchMock.mock.calls[1]).toEqual(['/api/admin/blocked-dates/date/2099-06-10', 'token-123', { method: 'DELETE' }]);
    expect(adminFetchMock.mock.calls[2]).toEqual(['/api/admin/blocked-dates/date/2099-06-11', 'token-123', { method: 'DELETE' }]);
    expect(adminFetchMock.mock.calls.some(([, , options]) => options?.method === 'POST')).toBe(false);

    await waitFor(() => {
      expect(getByRole('button', { name: '10' }).className).not.toContain('blocked');
      expect(getByRole('button', { name: '11' }).className).not.toContain('blocked');
    });
  });
});
