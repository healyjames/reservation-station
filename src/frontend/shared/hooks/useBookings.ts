import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Reservation } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';

type AdminBlockedDateRow = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason?: string | null;
};

type MonthCacheEntry = {
  reservationsByDate: Map<string, Reservation[]>;
  blockedRowsByDate: Map<string, AdminBlockedDateRow[]>;
  fetchedAt: number;
};

export type UseBookingsReturn = {
  currentDate: Signal<Date>;
  reservations: Signal<Reservation[]>;
  isLoading: Signal<boolean>;
  errorMessage: Signal<string>;
  guestCount: Signal<number>;
  isDayBlocked: Signal<boolean>;
  isBlockLoading: Signal<boolean>;
  fetchBookings: (date: Date) => Promise<void>;
  prevDay: () => void;
  nextDay: () => void;
  deleteBooking: (id: string) => Promise<void>;
  toggleDayBlock: () => Promise<void>;
  refreshMonth: () => Promise<void>;
};

export function useBookings(getToken: () => string | null): UseBookingsReturn {
  const currentDate = useSignal(new Date());
  const reservations = useSignal<Reservation[]>([]);
  const isLoading = useSignal(false);
  const errorMessage = useSignal('');
  const guestCount = useSignal(0);
  const isDayBlocked = useSignal(false);
  const isBlockLoading = useSignal(false);
  const monthCache = useSignal<Map<string, MonthCacheEntry>>(new Map());
  const inFlightMonthKey = useSignal<string | null>(null);

  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  function monthKeyFromDate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function dateKeyFromDate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function cloneCache(): Map<string, MonthCacheEntry> {
    return new Map(monthCache.value);
  }

  function applyVisibleDay(date: Date): void {
    const entry = monthCache.value.get(monthKeyFromDate(date));
    if (!entry) {
      reservations.value = [];
      guestCount.value = 0;
      isDayBlocked.value = false;
      return;
    }
    const dateKey = dateKeyFromDate(date);
    const dayReservations = entry.reservationsByDate.get(dateKey) ?? [];
    const dayBlocks = entry.blockedRowsByDate.get(dateKey) ?? [];
    reservations.value = dayReservations;
    guestCount.value = dayReservations.reduce((sum, row) => sum + (row.guests || 0), 0);
    isDayBlocked.value = dayBlocks.some((row) => row.start_time === null);
  }

  function buildMonthEntry(monthReservations: Reservation[], monthBlockedRows: AdminBlockedDateRow[]): MonthCacheEntry {
    const reservationsByDate = new Map<string, Reservation[]>();
    const blockedRowsByDate = new Map<string, AdminBlockedDateRow[]>();

    for (const row of monthReservations) {
      const list = reservationsByDate.get(row.reservation_date) ?? [];
      reservationsByDate.set(row.reservation_date, [...list, row]);
    }

    for (const [dateKey, list] of reservationsByDate) {
      reservationsByDate.set(
        dateKey,
        [...list].sort((a, b) => a.reservation_time.localeCompare(b.reservation_time)),
      );
    }

    for (const row of monthBlockedRows) {
      const list = blockedRowsByDate.get(row.date) ?? [];
      blockedRowsByDate.set(row.date, [...list, row]);
    }

    return { reservationsByDate, blockedRowsByDate, fetchedAt: Date.now() };
  }

  async function loadMonth(date: Date, force = false): Promise<void> {
    const tok = getToken();
    if (!tok) return;

    const monthKey = monthKeyFromDate(date);

    if (!force && monthCache.value.has(monthKey)) {
      applyVisibleDay(date);
      return;
    }

    if (inFlightMonthKey.value === monthKey) return;

    isLoading.value = true;
    errorMessage.value = '';
    inFlightMonthKey.value = monthKey;

    try {
      const [reservationsRes, blockedRes] = await Promise.all([
        adminFetch(`/api/admin/reservations?month=${monthKey}`, tok),
        adminFetch(`/api/admin/blocked-dates?month=${monthKey}`, tok),
      ]);

      if (!reservationsRes.ok) {
        errorMessage.value = `Failed to load bookings (HTTP ${reservationsRes.status})`;
        return;
      }
      if (!blockedRes.ok) {
        errorMessage.value = `Failed to load blocked dates (HTTP ${blockedRes.status})`;
        return;
      }

      const monthReservations = (await reservationsRes.json()) as Reservation[];
      const monthBlockedRows = (await blockedRes.json()) as AdminBlockedDateRow[];
      const nextCache = cloneCache();
      nextCache.set(monthKey, buildMonthEntry(monthReservations, monthBlockedRows));
      monthCache.value = nextCache;
      applyVisibleDay(date);
    } catch {
      errorMessage.value = 'Failed to load bookings. Please try again.';
    } finally {
      inFlightMonthKey.value = null;
      isLoading.value = false;
    }
  }

  async function syncSingleDay(date: Date): Promise<void> {
    const tok = getToken();
    if (!tok) return;

    const dateKey = dateKeyFromDate(date);
    const monthKey = monthKeyFromDate(date);

    isLoading.value = true;
    errorMessage.value = '';

    try {
      const res = await adminFetch(`/api/admin/reservations?date=${dateKey}`, tok);
      if (!res.ok) {
        errorMessage.value = `Failed to load bookings (HTTP ${res.status})`;
        return;
      }
      const dayReservations = (await res.json()) as Reservation[];
      const nextCache = cloneCache();
      const entry = nextCache.get(monthKey);
      if (!entry) return;

      const sorted = [...dayReservations].sort((a, b) => a.reservation_time.localeCompare(b.reservation_time));
      entry.reservationsByDate.set(dateKey, sorted);
      nextCache.set(monthKey, entry);
      monthCache.value = nextCache;
      applyVisibleDay(date);
    } catch {
      errorMessage.value = 'Failed to load bookings. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchBookings(date: Date): Promise<void> {
    const requestedMonthKey = monthKeyFromDate(date);
    const requestedDateKey = dateKeyFromDate(date);
    const currentDateKey = dateKeyFromDate(currentDate.value);

    currentDate.value = date;
    errorMessage.value = '';

    if (!monthCache.value.has(requestedMonthKey)) {
      await loadMonth(date);
      return;
    }

    if (requestedDateKey !== currentDateKey) {
      applyVisibleDay(date);
      return;
    }

    await syncSingleDay(date);
  }

  async function goToDate(date: Date): Promise<void> {
    currentDate.value = date;
    if (monthCache.value.has(monthKeyFromDate(date))) {
      applyVisibleDay(date);
      return;
    }
    reservations.value = [];
    guestCount.value = 0;
    isDayBlocked.value = false;
    await loadMonth(date);
  }

  function prevDay(): void {
    const next = new Date(currentDate.value);
    next.setDate(next.getDate() - 1);
    void goToDate(next);
  }

  function nextDay(): void {
    const next = new Date(currentDate.value);
    next.setDate(next.getDate() + 1);
    void goToDate(next);
  }

  async function deleteBooking(id: string): Promise<void> {
    const tok = getToken();
    if (!tok) return;

    const res = await adminFetch(`/api/admin/reservations/${id}`, tok, { method: 'DELETE' });
    if (!res.ok) return;

    const monthKey = monthKeyFromDate(currentDate.value);
    const dateKey = dateKeyFromDate(currentDate.value);
    const nextCache = cloneCache();
    const entry = nextCache.get(monthKey);
    if (!entry) return;

    entry.reservationsByDate.set(
      dateKey,
      (entry.reservationsByDate.get(dateKey) ?? []).filter((row) => row.id !== id),
    );
    nextCache.set(monthKey, entry);
    monthCache.value = nextCache;
    applyVisibleDay(currentDate.value);
  }

  async function toggleDayBlock(): Promise<void> {
    const tok = getToken();
    if (!tok) return;

    isBlockLoading.value = true;
    const dateKey = dateKeyFromDate(currentDate.value);
    const monthKey = monthKeyFromDate(currentDate.value);

    try {
      if (isDayBlocked.value) {
        const res = await adminFetch(`/api/admin/blocked-dates/date/${dateKey}`, tok, { method: 'DELETE' });
        if (!res.ok) return;

        const nextCache = cloneCache();
        const entry = nextCache.get(monthKey);
        if (entry) {
          entry.blockedRowsByDate.set(
            dateKey,
            (entry.blockedRowsByDate.get(dateKey) ?? []).filter((row) => row.start_time !== null),
          );
          nextCache.set(monthKey, entry);
          monthCache.value = nextCache;
        }
        applyVisibleDay(currentDate.value);
      } else {
        const res = await adminFetch('/api/admin/blocked-dates', tok, {
          method: 'POST',
          body: JSON.stringify({ date: dateKey }),
        });
        if (!res.ok) return;

        const created = (await res.json()) as AdminBlockedDateRow;
        const nextCache = cloneCache();
        const entry = nextCache.get(monthKey);
        if (entry) {
          const existing = entry.blockedRowsByDate.get(dateKey) ?? [];
          entry.blockedRowsByDate.set(dateKey, [...existing, created]);
          nextCache.set(monthKey, entry);
          monthCache.value = nextCache;
        }
        applyVisibleDay(currentDate.value);
      }
    } finally {
      isBlockLoading.value = false;
    }
  }

  async function refreshMonth(): Promise<void> {
    monthCache.value = new Map();
    await loadMonth(currentDate.value, true);
  }

  useEffect(() => {
    void fetchBookings(currentDate.value);
  }, []);

  return {
    currentDate,
    reservations,
    isLoading,
    errorMessage,
    guestCount,
    isDayBlocked,
    isBlockLoading,
    fetchBookings,
    prevDay,
    nextDay,
    deleteBooking,
    toggleDayBlock,
    refreshMonth,
  };
}
