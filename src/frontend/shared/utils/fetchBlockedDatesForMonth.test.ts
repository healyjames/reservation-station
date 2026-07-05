import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchBlockedDatesForMonth, bustMonth } from './fetchBlockedDatesForMonth';

const TTL_MS = 5 * 60 * 1000;

describe('fetchBlockedDatesForMonth', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cache miss: fetches from network, returns adminBlocked and closed sets', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        blocked_dates: ['2024-01-15', '2024-01-20'],
        closed_dates: ['2024-01-07', '2024-01-14'],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchBlockedDatesForMonth('tenant-miss-1', 2024, 0);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.aborted).toBe(false);
    expect(result.error).toBe(false);
    expect(result.adminBlocked.has('2024-01-15')).toBe(true);
    expect(result.adminBlocked.has('2024-01-20')).toBe(true);
    expect(result.closed.has('2024-01-07')).toBe(true);
    expect(result.closed.has('2024-01-14')).toBe(true);
  });

  it('populates only closed when blocked_dates is empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        blocked_dates: [],
        closed_dates: ['2024-03-03', '2024-03-10'],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchBlockedDatesForMonth('tenant-closed-only-1', 2024, 2);

    expect(result.adminBlocked.size).toBe(0);
    expect(result.closed.has('2024-03-03')).toBe(true);
    expect(result.closed.has('2024-03-10')).toBe(true);
  });

  it('populates only adminBlocked when closed_dates is empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        blocked_dates: ['2024-04-05'],
        closed_dates: [],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchBlockedDatesForMonth('tenant-admin-only-1', 2024, 3);

    expect(result.adminBlocked.has('2024-04-05')).toBe(true);
    expect(result.closed.size).toBe(0);
  });

  it('cache hit: second call with the same key returns without re-fetching', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ blocked_dates: ['2024-02-10'], closed_dates: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchBlockedDatesForMonth('tenant-hit-1', 2024, 1);
    const result = await fetchBlockedDatesForMonth('tenant-hit-1', 2024, 1);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.adminBlocked.has('2024-02-10')).toBe(true);
    expect(result.aborted).toBe(false);
    expect(result.error).toBe(false);
  });

  it('expired cache: re-fetches after TTL elapses', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ blocked_dates: [], closed_dates: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchBlockedDatesForMonth('tenant-ttl-1', 2024, 2);
    vi.advanceTimersByTime(TTL_MS + 1);
    await fetchBlockedDatesForMonth('tenant-ttl-1', 2024, 2);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('network error: returns empty sets with error: true', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchBlockedDatesForMonth('tenant-neterr-1', 2024, 3);

    expect(result.error).toBe(true);
    expect(result.aborted).toBe(false);
    expect(result.adminBlocked.size).toBe(0);
    expect(result.closed.size).toBe(0);
  });

  it('non-ok response: returns empty sets with error: true', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchBlockedDatesForMonth('tenant-nonok-1', 2024, 4);

    expect(result.error).toBe(true);
    expect(result.aborted).toBe(false);
    expect(result.adminBlocked.size).toBe(0);
    expect(result.closed.size).toBe(0);
  });

  it('AbortError: second call before first completes aborts the first and returns { aborted: true }', async () => {
    const mockFetch = vi.fn()
      .mockImplementationOnce((_url: string, { signal }: { signal: AbortSignal }) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ blocked_dates: [], closed_dates: [] }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const firstPromise = fetchBlockedDatesForMonth('tenant-abort-1', 2024, 5);
    const secondPromise = fetchBlockedDatesForMonth('tenant-abort-1', 2024, 5);

    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);

    expect(firstResult.aborted).toBe(true);
    expect(firstResult.error).toBe(false);
    expect(secondResult.aborted).toBe(false);
    expect(secondResult.error).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('bustMonth: busted entry is re-fetched on the next call', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ blocked_dates: [], closed_dates: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchBlockedDatesForMonth('tenant-bust-1', 2024, 6);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    bustMonth('tenant-bust-1', 2024, 6);
    await fetchBlockedDatesForMonth('tenant-bust-1', 2024, 6);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});