// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import type { AdminDateOverride } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import { useDateOverrides } from './useDateOverrides';

vi.mock('@shared/utils/adminFetch', () => ({
  adminFetch: vi.fn(),
}));

const adminFetchMock = vi.mocked(adminFetch);

function makeResponse<T>(body: T, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function makeOverride(overrides: Partial<AdminDateOverride> = {}): AdminDateOverride {
  return { id: 'o1', date: '2099-06-10', is_closed: 0, open_time: '12:00', close_time: '16:00', reason: null, ...overrides };
}

describe('useDateOverrides', () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
  });

  it('loads a month of special hours keyed by date, once', async () => {
    adminFetchMock.mockResolvedValue(makeResponse({ success: true, data: [makeOverride()] }));
    const { result } = renderHook(() => useDateOverrides(() => 'token-123'));

    await act(async () => {
      await result.current.loadMonth('2099-06');
      await result.current.loadMonth('2099-06');
    });

    expect(adminFetchMock).toHaveBeenCalledTimes(1);
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/date-overrides?month=2099-06', 'token-123');
    expect(result.current.overridesByDate.value.get('2099-06-10')).toEqual(makeOverride());
  });

  it('replaces a month when forced, keeping other months', async () => {
    const june = makeOverride();
    const july = makeOverride({ id: 'o2', date: '2099-07-04' });
    adminFetchMock
      .mockResolvedValueOnce(makeResponse({ success: true, data: [june] }))
      .mockResolvedValueOnce(makeResponse({ success: true, data: [july] }))
      .mockResolvedValueOnce(makeResponse({ success: true, data: [] }));
    const { result } = renderHook(() => useDateOverrides(() => 'token-123'));

    await act(async () => {
      await result.current.loadMonth('2099-06');
      await result.current.loadMonth('2099-07');
      await result.current.loadMonth('2099-06', true);
    });

    expect([...result.current.overridesByDate.value.keys()]).toEqual(['2099-07-04']);
  });

  it('tries a month again after a failed load', async () => {
    adminFetchMock
      .mockResolvedValueOnce(makeResponse({ error: 'boom' }, 500))
      .mockResolvedValueOnce(makeResponse({ success: true, data: [makeOverride()] }));
    const { result } = renderHook(() => useDateOverrides(() => 'token-123'));

    await act(async () => {
      await result.current.loadMonth('2099-06');
    });
    expect(result.current.overridesByDate.value.size).toBe(0);

    await act(async () => {
      await result.current.loadMonth('2099-06');
    });
    expect(result.current.overridesByDate.value.size).toBe(1);
  });

  it('makes no request without a token', async () => {
    const { result } = renderHook(() => useDateOverrides(() => null));

    await act(async () => {
      await result.current.loadMonth('2099-06');
    });

    expect(adminFetchMock).not.toHaveBeenCalled();
  });
});
