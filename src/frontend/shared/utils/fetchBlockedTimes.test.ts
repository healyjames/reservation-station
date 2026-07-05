import { afterEach, describe, expect, it, vi } from 'vitest';
import { bustBlockedTimesCache, fetchBlockedTimes } from './fetchBlockedTimes';

const TTL_MS = 60 * 1000;

const TEST_DATE = { year: 2099, month: 5, day: 15 };

describe('fetchBlockedTimes', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cache hit: same tenant/date/guests/maxCovers returns cached result without re-fetching', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ blocked_times: ['12:00', '12:30'] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchBlockedTimes({ tenantId: 'tenant-ft-hit-1', date: TEST_DATE, guests: 2, maxCovers: 40 });
    const result = await fetchBlockedTimes({ tenantId: 'tenant-ft-hit-1', date: TEST_DATE, guests: 2, maxCovers: 40 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.blockedTimes).toEqual(['12:00', '12:30']);
    expect(result.aborted).toBe(false);
    expect(result.error).toBe(false);
  });

  it('cache miss: different guest count triggers a new fetch when maxCovers is greater than zero', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ blocked_times: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchBlockedTimes({ tenantId: 'tenant-ft-miss-1', date: TEST_DATE, guests: 2, maxCovers: 40 });
    await fetchBlockedTimes({ tenantId: 'tenant-ft-miss-1', date: TEST_DATE, guests: 4, maxCovers: 40 });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('cache hit: different guest count reuses the cache when maxCovers is zero', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ blocked_times: ['18:00'] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchBlockedTimes({ tenantId: 'tenant-ft-unlimited-1', date: TEST_DATE, guests: 2, maxCovers: 0 });
    const result = await fetchBlockedTimes({ tenantId: 'tenant-ft-unlimited-1', date: TEST_DATE, guests: 4, maxCovers: 0 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.blockedTimes).toEqual(['18:00']);
    expect(result.aborted).toBe(false);
    expect(result.error).toBe(false);
  });

  it('cache expiry: re-fetches after the 60s TTL elapses', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ blocked_times: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchBlockedTimes({ tenantId: 'tenant-ft-ttl-1', date: TEST_DATE, guests: 2, maxCovers: 40 });
    vi.advanceTimersByTime(TTL_MS + 1);
    await fetchBlockedTimes({ tenantId: 'tenant-ft-ttl-1', date: TEST_DATE, guests: 2, maxCovers: 40 });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('network error: returns { blockedTimes: [], aborted: false, error: true }', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchBlockedTimes({ tenantId: 'tenant-ft-neterr-1', date: TEST_DATE, guests: 2, maxCovers: 40 });

    expect(result).toEqual({ blockedTimes: [], aborted: false, error: true });
  });

  it('non-ok response: returns { blockedTimes: [], aborted: false, error: true }', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchBlockedTimes({ tenantId: 'tenant-ft-nonok-1', date: TEST_DATE, guests: 2, maxCovers: 40 });

    expect(result).toEqual({ blockedTimes: [], aborted: false, error: true });
  });

  it('AbortError: second in-flight call aborts the first', async () => {
    const mockFetch = vi
      .fn()
      .mockImplementationOnce(
        (_url: string, { signal }: { signal: AbortSignal }) =>
          new Promise<never>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ blocked_times: ['19:00'] }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const firstPromise = fetchBlockedTimes({ tenantId: 'tenant-ft-abort-1', date: TEST_DATE, guests: 2, maxCovers: 40 });
    const secondPromise = fetchBlockedTimes({ tenantId: 'tenant-ft-abort-1', date: TEST_DATE, guests: 4, maxCovers: 40 });

    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);

    expect(firstResult).toEqual({ blockedTimes: [], aborted: true, error: false });
    expect(secondResult).toEqual({ blockedTimes: ['19:00'], aborted: false, error: false });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('bustBlockedTimesCache: busts all guest variants for a date', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ blocked_times: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchBlockedTimes({ tenantId: 'tenant-ft-bust-1', date: TEST_DATE, guests: 2, maxCovers: 40 });
    await fetchBlockedTimes({ tenantId: 'tenant-ft-bust-1', date: TEST_DATE, guests: 4, maxCovers: 40 });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    bustBlockedTimesCache('tenant-ft-bust-1', TEST_DATE);

    await fetchBlockedTimes({ tenantId: 'tenant-ft-bust-1', date: TEST_DATE, guests: 2, maxCovers: 40 });
    await fetchBlockedTimes({ tenantId: 'tenant-ft-bust-1', date: TEST_DATE, guests: 4, maxCovers: 40 });

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
