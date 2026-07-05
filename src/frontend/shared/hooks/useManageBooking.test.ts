// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useManageBooking } from './useManageBooking';
import { bustMonth } from '@shared/utils/fetchBlockedDatesForMonth';
import type { Reservation, TenantConfig } from '@shared/types';
import type { EditData } from '@shared/types';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-123',
    tenant_id: 'tenant-test',
    first_name: 'John',
    surname: 'Doe',
    telephone: '01234567890',
    email: 'john@example.com',
    reservation_date: '2024-01-15',
    reservation_time: '18:00',
    guests: 2,
    ...overrides,
  };
}

function makeTenant(overrides: Partial<TenantConfig> = {}): TenantConfig {
  return {
    id: 'tenant-test',
    name: 'Test Venue',
    tenant_code: 'test-venue',
    max_guests: 8,
    max_covers: 40,
    status: 'active',
    concurrent_guests_time_limit: 120,
    opening_hours: null,
    ...overrides,
  };
}

const sampleEditData: EditData = {
  first_name: 'Jane',
  surname: 'Smith',
  telephone: '09876543210',
  email: 'jane@example.com',
  dietary_requirements: '',
  guests: 2,
};

describe('useManageBooking', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    // First two fetches are always the init() calls: GET reservation + GET tenant
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => makeReservation() })
      .mockResolvedValueOnce({ ok: true, json: async () => makeTenant() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    bustMonth('tenant-test', 2024, 0);
  });

  /** Renders the hook and flushes the async init() effect. */
  async function renderAndInit() {
    const renderResult = renderHook(() =>
      useManageBooking('res-123', 'john@example.com', null),
    );
    // Flush the useEffect and all microtasks from init()'s two fetch calls
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    return renderResult;
  }

  describe('saveEditDetails double-submit guard', () => {
    it('second in-flight call returns early without making another fetch', async () => {
      let resolvePatch!: (r: Response) => void;
      const hangingPatch = new Promise<Response>((resolve) => {
        resolvePatch = resolve;
      });
      // Third fetch: slow PATCH — stays pending until we resolve it manually
      mockFetch.mockImplementationOnce(() => hangingPatch);

      const { result } = await renderAndInit();
      expect(result.current.view.value).toBe('overview');

      // First save — sets isSaving=true, then suspends on await fetch
      const firstSave = result.current.saveEditDetails(sampleEditData);
      expect(result.current.isSaving.value).toBe(true);

      // Second save — guard fires immediately, no new fetch
      await result.current.saveEditDetails(sampleEditData);

      // Resolve the hanging patch so the test can clean up
      resolvePatch({ ok: true, json: async () => ({}) } as Response);
      await act(async () => { await firstSave; });

      const patchCalls = mockFetch.mock.calls.filter(
        ([, options]) => (options as RequestInit)?.method === 'PATCH',
      );
      expect(patchCalls).toHaveLength(1);
    });

    it('isSaving resets to false after a successful save', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = await renderAndInit();

      await act(async () => {
        await result.current.saveEditDetails(sampleEditData);
      });

      expect(result.current.isSaving.value).toBe(false);
    });

    it('isSaving resets to false even after a network error (finally block)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = await renderAndInit();

      await act(async () => {
        await result.current.saveEditDetails(sampleEditData);
      });

      expect(result.current.isSaving.value).toBe(false);
    });
  });

  describe('saveDatetime double-submit guard', () => {
    it('second in-flight call returns early without making another fetch', async () => {
      let resolvePatch!: (r: Response) => void;
      const hangingPatch = new Promise<Response>((resolve) => {
        resolvePatch = resolve;
      });
      mockFetch.mockImplementationOnce(() => hangingPatch);

      const { result } = await renderAndInit();
      expect(result.current.view.value).toBe('overview');

      // Provide the required selectedDate and selectedTime so saveDatetime proceeds
      result.current.selectedDate.value = { year: 2024, month: 0, day: 20 };
      result.current.selectedTime.value = '19:00';

      const firstSave = result.current.saveDatetime();
      expect(result.current.isSaving.value).toBe(true);

      await result.current.saveDatetime();

      resolvePatch({ ok: true, json: async () => ({}) } as Response);
      await act(async () => { await firstSave; });

      const patchCalls = mockFetch.mock.calls.filter(
        ([, options]) => (options as RequestInit)?.method === 'PATCH',
      );
      expect(patchCalls).toHaveLength(1);
    });

    it('isSaving resets to false after saveDatetime resolves', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = await renderAndInit();
      result.current.selectedDate.value = { year: 2024, month: 0, day: 20 };
      result.current.selectedTime.value = '19:00';

      await act(async () => {
        await result.current.saveDatetime();
      });

      expect(result.current.isSaving.value).toBe(false);
    });
  });

  describe('confirmCancel double-submit guard', () => {
    it('second in-flight call returns early without making another fetch', async () => {
      let resolveDelete!: (r: Response) => void;
      const hangingDelete = new Promise<Response>((resolve) => {
        resolveDelete = resolve;
      });
      mockFetch.mockImplementationOnce(() => hangingDelete);

      const { result } = await renderAndInit();
      expect(result.current.view.value).toBe('overview');

      const firstCancel = result.current.confirmCancel();
      expect(result.current.isCancelling.value).toBe(true);

      // Second call hits the guard
      await result.current.confirmCancel();

      resolveDelete({ ok: true, json: async () => ({}) } as Response);
      await act(async () => { await firstCancel; });

      const deleteCalls = mockFetch.mock.calls.filter(
        ([, options]) => (options as RequestInit)?.method === 'DELETE',
      );
      expect(deleteCalls).toHaveLength(1);
    });

    it('isCancelling resets to false after confirmCancel resolves', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = await renderAndInit();

      await act(async () => {
        await result.current.confirmCancel();
      });

      expect(result.current.isCancelling.value).toBe(false);
    });
  });

  describe('goToChangeDatetime', () => {
    it('populates closedDates from API response and leaves blockedDates empty when only closed_dates present', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            blocked_dates: [],
            closed_dates: ['2024-01-13', '2024-01-14'],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ blocked_times: [] }),
        });

      const { result } = await renderAndInit();

      await act(async () => {
        await result.current.goToChangeDatetime();
      });

      expect(result.current.closedDates.value.has('2024-01-13')).toBe(true);
      expect(result.current.closedDates.value.has('2024-01-14')).toBe(true);
      expect(result.current.blockedDates.value.size).toBe(0);
    });

    it('populates both blockedDates and closedDates independently', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            blocked_dates: ['2024-01-10'],
            closed_dates: ['2024-01-13', '2024-01-14'],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ blocked_times: [] }),
        });

      const { result } = await renderAndInit();

      await act(async () => {
        await result.current.goToChangeDatetime();
      });

      expect(result.current.blockedDates.value.has('2024-01-10')).toBe(true);
      expect(result.current.closedDates.value.has('2024-01-13')).toBe(true);
      expect(result.current.closedDates.value.has('2024-01-14')).toBe(true);
    });
  });
});
