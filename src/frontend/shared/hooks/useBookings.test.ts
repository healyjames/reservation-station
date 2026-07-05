// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import type { Reservation } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import { useBookings } from './useBookings';

vi.mock('@shared/utils/adminFetch', () => ({
  adminFetch: vi.fn(),
}));

type AdminBlockedDateRow = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason?: string | null;
};

const TOKEN = 'token-123';
const INITIAL_NOW = new Date('2099-06-01T12:00:00.000Z');
const JUNE_1 = new Date('2099-06-01T12:00:00.000Z');
const JUNE_2 = new Date('2099-06-02T12:00:00.000Z');
const JULY_2 = new Date('2099-07-02T12:00:00.000Z');
const JULY_3 = new Date('2099-07-03T12:00:00.000Z');

const adminFetchMock = vi.mocked(adminFetch);

function makeResponse<T>(body: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: '00000000-0000-4000-8000-000000000901',
    tenant_id: '00000000-0000-4000-8000-000000000101',
    first_name: 'Ada',
    surname: 'Lovelace',
    telephone: '+441234567890',
    email: 'ada@example.com',
    reservation_date: '2099-06-01',
    reservation_time: '18:00',
    guests: 2,
    dietary_requirements: '',
    ...overrides,
  };
}

function makeBlockedRow(overrides: Partial<AdminBlockedDateRow> = {}): AdminBlockedDateRow {
  return {
    id: '00000000-0000-4000-8000-000000000951',
    date: '2099-06-01',
    start_time: null,
    end_time: null,
    reason: 'Closed',
    ...overrides,
  };
}

async function flushHook(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderLoadedHook({
  reservations = [makeReservation()],
  blockedRows = [makeBlockedRow()],
}: {
  reservations?: Reservation[];
  blockedRows?: AdminBlockedDateRow[];
} = {}) {
  adminFetchMock.mockResolvedValueOnce(makeResponse(reservations)).mockResolvedValueOnce(makeResponse(blockedRows));

  const renderResult = renderHook(() => useBookings(() => TOKEN));

  await flushHook();

  expect(adminFetchMock).toHaveBeenCalledTimes(2);
  expect(adminFetchMock.mock.calls[0]?.[0]).toBe('/api/admin/reservations?month=2099-06');
  expect(adminFetchMock.mock.calls[1]?.[0]).toBe('/api/admin/blocked-dates?month=2099-06');

  adminFetchMock.mockClear();

  return renderResult;
}

describe('useBookings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(INITIAL_NOW);
    adminFetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cold load: fetchBookings loads month endpoints and sets reservations plus full-day blocked state', async () => {
    const { result } = await renderLoadedHook({
      reservations: [makeReservation()],
      blockedRows: [],
    });

    const julyReservation = makeReservation({
      id: '00000000-0000-4000-8000-000000000902',
      reservation_date: '2099-07-02',
      reservation_time: '19:30',
      guests: 4,
    });

    adminFetchMock.mockResolvedValueOnce(makeResponse([julyReservation])).mockResolvedValueOnce(
      makeResponse([
        makeBlockedRow({
          id: '00000000-0000-4000-8000-000000000952',
          date: '2099-07-02',
          start_time: null,
          end_time: null,
        }),
      ]),
    );

    await act(async () => {
      await result.current.fetchBookings(JULY_2);
    });

    expect(adminFetchMock).toHaveBeenCalledTimes(2);
    expect(adminFetchMock.mock.calls[0]?.[0]).toBe('/api/admin/reservations?month=2099-07');
    expect(adminFetchMock.mock.calls[1]?.[0]).toBe('/api/admin/blocked-dates?month=2099-07');
    expect(result.current.reservations.value).toEqual([julyReservation]);
    expect(result.current.isDayBlocked.value).toBe(true);
  });

  it('warm navigation: different day in the same cached month updates state without more network calls', async () => {
    const juneFirstReservation = makeReservation({
      id: '00000000-0000-4000-8000-000000000903',
      reservation_date: '2099-06-01',
      reservation_time: '18:30',
    });
    const juneSecondReservation = makeReservation({
      id: '00000000-0000-4000-8000-000000000904',
      reservation_date: '2099-06-02',
      reservation_time: '20:00',
      guests: 5,
    });

    const { result } = await renderLoadedHook({
      reservations: [juneFirstReservation, juneSecondReservation],
      blockedRows: [],
    });

    await act(async () => {
      await result.current.fetchBookings(JUNE_2);
    });

    expect(adminFetchMock).not.toHaveBeenCalled();
    expect(result.current.reservations.value).toEqual([juneSecondReservation]);
    expect(result.current.guestCount.value).toBe(5);
  });

  it('same-day sync: refetches the current day and updates the cached day data', async () => {
    const staleReservation = makeReservation({
      id: '00000000-0000-4000-8000-000000000905',
      reservation_time: '17:00',
    });
    const otherDayReservation = makeReservation({
      id: '00000000-0000-4000-8000-000000000906',
      reservation_date: '2099-06-02',
      reservation_time: '20:00',
    });
    const refreshedReservation = makeReservation({
      id: '00000000-0000-4000-8000-000000000907',
      reservation_time: '19:00',
      guests: 6,
    });

    const { result } = await renderLoadedHook({
      reservations: [staleReservation, otherDayReservation],
      blockedRows: [],
    });

    adminFetchMock.mockResolvedValueOnce(makeResponse([refreshedReservation]));

    await act(async () => {
      await result.current.fetchBookings(JUNE_1);
    });

    await act(async () => {
      await result.current.fetchBookings(JUNE_2);
      await result.current.fetchBookings(JUNE_1);
    });

    expect(adminFetchMock).toHaveBeenCalledTimes(1);
    expect(adminFetchMock.mock.calls[0]?.[0]).toBe('/api/admin/reservations?date=2099-06-01');
    expect(result.current.reservations.value).toEqual([refreshedReservation]);
    expect(result.current.guestCount.value).toBe(6);
  });

  it('in-flight dedup: concurrent fetchBookings calls for the same month share the same month load', async () => {
    const { result } = await renderLoadedHook({
      reservations: [makeReservation()],
      blockedRows: [],
    });

    let resolveReservations!: (value: Response) => void;
    let resolveBlockedRows!: (value: Response) => void;

    const reservationsPromise = new Promise<Response>((resolve) => {
      resolveReservations = resolve;
    });
    const blockedRowsPromise = new Promise<Response>((resolve) => {
      resolveBlockedRows = resolve;
    });

    adminFetchMock.mockImplementationOnce(() => reservationsPromise).mockImplementationOnce(() => blockedRowsPromise);

    await act(async () => {
      const firstCall = result.current.fetchBookings(JULY_3);
      const secondCall = result.current.fetchBookings(JULY_3);

      expect(adminFetchMock).toHaveBeenCalledTimes(2);

      resolveReservations(
        makeResponse([
          makeReservation({
            id: '00000000-0000-4000-8000-000000000908',
            reservation_date: '2099-07-03',
          }),
        ]),
      );
      resolveBlockedRows(makeResponse([]));

      await Promise.all([firstCall, secondCall]);
    });

    expect(adminFetchMock).toHaveBeenCalledTimes(2);
  });

  it('isDayBlocked is true only for full-day blocks and stays false for partial-time blocks', async () => {
    const { result } = await renderLoadedHook({
      reservations: [makeReservation()],
      blockedRows: [
        makeBlockedRow({
          id: '00000000-0000-4000-8000-000000000953',
          date: '2099-06-01',
          start_time: null,
          end_time: null,
        }),
        makeBlockedRow({
          id: '00000000-0000-4000-8000-000000000954',
          date: '2099-06-02',
          start_time: '18:00',
          end_time: '19:00',
        }),
      ],
    });

    expect(result.current.isDayBlocked.value).toBe(true);

    await act(async () => {
      await result.current.fetchBookings(JUNE_2);
    });

    expect(adminFetchMock).not.toHaveBeenCalled();
    expect(result.current.isDayBlocked.value).toBe(false);
  });

  it('deleteBooking removes the booking from cache and updates visible reservations without a refetch', async () => {
    const firstReservation = makeReservation({
      id: '00000000-0000-4000-8000-000000000909',
      reservation_time: '18:00',
      guests: 2,
    });
    const secondReservation = makeReservation({
      id: '00000000-0000-4000-8000-000000000910',
      reservation_time: '19:00',
      guests: 3,
    });

    const { result } = await renderLoadedHook({
      reservations: [firstReservation, secondReservation],
      blockedRows: [],
    });

    adminFetchMock.mockResolvedValueOnce(makeResponse({ success: true }));

    await act(async () => {
      await result.current.deleteBooking(firstReservation.id);
    });

    expect(adminFetchMock).toHaveBeenCalledTimes(1);
    expect(adminFetchMock.mock.calls[0]?.[0]).toBe(`/api/admin/reservations/${firstReservation.id}`);
    expect(adminFetchMock.mock.calls[0]?.[2]).toEqual({ method: 'DELETE' });
    expect(result.current.reservations.value).toEqual([secondReservation]);
    expect(result.current.guestCount.value).toBe(3);
  });

  it('toggleDayBlock unblock: deletes the full-day block and clears isDayBlocked', async () => {
    const { result } = await renderLoadedHook({
      reservations: [makeReservation()],
      blockedRows: [
        makeBlockedRow({
          id: '00000000-0000-4000-8000-000000000955',
          start_time: null,
          end_time: null,
        }),
        makeBlockedRow({
          id: '00000000-0000-4000-8000-000000000956',
          start_time: '18:00',
          end_time: '19:00',
        }),
      ],
    });

    adminFetchMock.mockResolvedValueOnce(makeResponse({ success: true }));

    await act(async () => {
      await result.current.toggleDayBlock();
    });

    expect(adminFetchMock).toHaveBeenCalledTimes(1);
    expect(adminFetchMock.mock.calls[0]?.[0]).toBe('/api/admin/blocked-dates/date/2099-06-01');
    expect(adminFetchMock.mock.calls[0]?.[2]).toEqual({ method: 'DELETE' });
    expect(result.current.isDayBlocked.value).toBe(false);
  });

  it('toggleDayBlock block: posts a full-day block and sets isDayBlocked to true', async () => {
    const { result } = await renderLoadedHook({
      reservations: [makeReservation()],
      blockedRows: [],
    });

    adminFetchMock.mockResolvedValueOnce(
      makeResponse(
        makeBlockedRow({
          id: '00000000-0000-4000-8000-000000000957',
          start_time: null,
          end_time: null,
        }),
      ),
    );

    await act(async () => {
      await result.current.toggleDayBlock();
    });

    expect(adminFetchMock).toHaveBeenCalledTimes(1);
    expect(adminFetchMock.mock.calls[0]?.[0]).toBe('/api/admin/blocked-dates');
    expect(adminFetchMock.mock.calls[0]?.[2]).toEqual({
      method: 'POST',
      body: JSON.stringify({ date: '2099-06-01' }),
    });
    expect(result.current.isDayBlocked.value).toBe(true);
  });

  it('refreshMonth clears the cache and reloads the current month', async () => {
    const { result } = await renderLoadedHook({
      reservations: [
        makeReservation({
          id: '00000000-0000-4000-8000-000000000911',
          reservation_time: '18:00',
        }),
      ],
      blockedRows: [],
    });

    const refreshedReservation = makeReservation({
      id: '00000000-0000-4000-8000-000000000912',
      reservation_time: '20:30',
      guests: 7,
    });

    adminFetchMock.mockResolvedValueOnce(makeResponse([refreshedReservation])).mockResolvedValueOnce(makeResponse([makeBlockedRow()]));

    await act(async () => {
      await result.current.refreshMonth();
    });

    expect(adminFetchMock).toHaveBeenCalledTimes(2);
    expect(adminFetchMock.mock.calls[0]?.[0]).toBe('/api/admin/reservations?month=2099-06');
    expect(adminFetchMock.mock.calls[1]?.[0]).toBe('/api/admin/blocked-dates?month=2099-06');
    expect(result.current.reservations.value).toEqual([refreshedReservation]);
    expect(result.current.isDayBlocked.value).toBe(true);
  });

  it('no token: fetchBookings returns early without making network calls', async () => {
    const { result } = renderHook(() => useBookings(() => null));

    await flushHook();

    expect(adminFetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.fetchBookings(JULY_2);
    });

    expect(adminFetchMock).not.toHaveBeenCalled();
    expect(result.current.reservations.value).toEqual([]);
    expect(result.current.isDayBlocked.value).toBe(false);
  });
});
