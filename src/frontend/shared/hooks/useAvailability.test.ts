// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useAvailability } from './useAvailability';

const TIMES_TTL_MS = 60 * 1000;

describe('useAvailability', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('fetchBlockedTimes cache', () => {
    it('cache hit: same tenant/date/guests returns cached result without re-fetching', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ blocked_times: ['12:00', '12:30'] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useAvailability());
      const date = { year: 2024, month: 0, day: 15 };

      await act(async () => {
        await result.current.fetchBlockedTimes('tenant-bt-hit-1', date, 2);
      });
      await act(async () => {
        await result.current.fetchBlockedTimes('tenant-bt-hit-1', date, 2);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.current.blockedTimes.value).toEqual(['12:00', '12:30']);
    });

    it('cache miss: different guests count triggers a new fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ blocked_times: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useAvailability());
      const date = { year: 2024, month: 1, day: 10 };

      await act(async () => {
        await result.current.fetchBlockedTimes('tenant-bt-guests-1', date, 2, 40);
      });
      await act(async () => {
        await result.current.fetchBlockedTimes('tenant-bt-guests-1', date, 4, 40);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('cache expiry: re-fetches after the 60s TTL elapses', async () => {
      vi.useFakeTimers();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ blocked_times: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useAvailability());
      const date = { year: 2024, month: 2, day: 5 };

      await act(async () => {
        await result.current.fetchBlockedTimes('tenant-bt-ttl-1', date, 2);
      });

      vi.advanceTimersByTime(TIMES_TTL_MS + 1);

      await act(async () => {
        await result.current.fetchBlockedTimes('tenant-bt-ttl-1', date, 2);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('AbortController: rapid successive calls abort earlier in-flight requests', async () => {
      const mockFetch = vi
        .fn()
        .mockImplementationOnce(
          (_url: string, { signal }: { signal: AbortSignal }) =>
            new Promise<never>((_, reject) => {
              signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            }),
        )
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ blocked_times: ['14:00'] }),
        });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useAvailability());
      const date = { year: 2024, month: 3, day: 20 };

      // Fire two calls without awaiting between them — second aborts the first
      const firstCall = result.current.fetchBlockedTimes('tenant-bt-abort-1', date, 2);
      const secondCall = result.current.fetchBlockedTimes('tenant-bt-abort-1', date, 4);

      await act(async () => {
        await Promise.all([firstCall, secondCall]);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Only the second call's result is applied; first was aborted
      expect(result.current.blockedTimes.value).toEqual(['14:00']);
    });
  });

  describe('fetchBlockedDates', () => {
    it('delegates to the /blocked-dates API endpoint and sets blockedDates from adminBlocked', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          blocked_dates: ['2024-01-05', '2024-01-12'],
          closed_dates: [],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useAvailability());

      await act(async () => {
        await result.current.fetchBlockedDates('tenant-bd-del-1', 2024, 0);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl: string = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/reservations/blocked-dates');
      expect(calledUrl).toContain('tenant-bd-del-1');
      expect(result.current.blockedDates.value.has('2024-01-05')).toBe(true);
      expect(result.current.blockedDates.value.has('2024-01-12')).toBe(true);
    });

    it('sets closedDates signal when API returns closed_dates', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          blocked_dates: [],
          closed_dates: ['2024-05-05', '2024-05-12'],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useAvailability());

      await act(async () => {
        await result.current.fetchBlockedDates('tenant-bd-closed-1', 2024, 4);
      });

      expect(result.current.closedDates.value.has('2024-05-05')).toBe(true);
      expect(result.current.closedDates.value.has('2024-05-12')).toBe(true);
      expect(result.current.blockedDates.value.size).toBe(0);
    });

    it('sets blockedDatesError when the response is not ok', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useAvailability());

      await act(async () => {
        await result.current.fetchBlockedDates('tenant-bd-err-1', 2024, 0);
      });

      expect(result.current.blockedDatesError.value).toBeTruthy();
      expect(result.current.isFetchingDates.value).toBe(false);
    });

    it('clears isFetchingDates after the fetch completes', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ blocked_dates: [], closed_dates: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useAvailability());

      await act(async () => {
        await result.current.fetchBlockedDates('tenant-bd-loading-1', 2024, 0);
      });

      expect(result.current.isFetchingDates.value).toBe(false);
    });
  });
});
