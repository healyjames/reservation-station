// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import type { OpeningHoursEntry } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import { useOpeningHours } from './useOpeningHours';

vi.mock('@shared/utils/adminFetch', () => ({
  adminFetch: vi.fn(),
}));

const adminFetchMock = vi.mocked(adminFetch);

function makeResponse<T>(body: T, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const monday: OpeningHoursEntry = { id: '1', tenant_id: 't', day_of_week: 1, is_closed: 0, open_time: '12:00', close_time: '22:00' };

describe('useOpeningHours', () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
  });

  it('is undefined until loaded, then holds the opening hours from the admin API', async () => {
    adminFetchMock.mockResolvedValueOnce(makeResponse({ success: true, data: [monday] }));

    const { result } = renderHook(() => useOpeningHours(() => 'token-123'));
    expect(result.current.openingHours.value).toBeUndefined();

    await waitFor(() => expect(result.current.openingHours.value).toEqual([monday]));
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/opening-hours', 'token-123');
  });

  it('is null when the tenant has no opening hours configured', async () => {
    adminFetchMock.mockResolvedValueOnce(makeResponse({ success: true, data: [] }));

    const { result } = renderHook(() => useOpeningHours(() => 'token-123'));

    await waitFor(() => expect(result.current.openingHours.value).toBeNull());
  });

  it('stays undefined when the request fails, and loads on a later reload', async () => {
    adminFetchMock.mockResolvedValueOnce(makeResponse({ error: 'boom' }, 500)).mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useOpeningHours(() => 'token-123'));
    await waitFor(() => expect(adminFetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.reloadOpeningHours();
    });
    expect(result.current.openingHours.value).toBeUndefined();

    adminFetchMock.mockResolvedValueOnce(makeResponse({ success: true, data: [monday] }));
    await act(async () => {
      await result.current.reloadOpeningHours();
    });
    expect(result.current.openingHours.value).toEqual([monday]);
  });

  it('makes no request without a token', async () => {
    const { result } = renderHook(() => useOpeningHours(() => null));
    await act(async () => {
      await result.current.reloadOpeningHours();
    });

    expect(adminFetchMock).not.toHaveBeenCalled();
    expect(result.current.openingHours.value).toBeUndefined();
  });
});
