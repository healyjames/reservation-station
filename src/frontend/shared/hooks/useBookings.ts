import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { AdminBlockedDate, Reservation, TimeBlockInput } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import { padTwo } from '@shared/utils/dates';

const REFRESH_COOLDOWN_MS = 3 * 60 * 1000;

const BLOCK_SAVE_ERROR = 'Could not update blocked times. Please try again.';

type MonthCacheEntry = {
  reservationsByDate: Map<string, Reservation[]>;
  blockedRowsByDate: Map<string, AdminBlockedDate[]>;
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
  /** The visible day's time-range blocks (full-day blocks excluded), earliest first. */
  dayBlocks: Signal<AdminBlockedDate[]>;
  blockErrorMessage: Signal<string>;
  fetchBookings: (date: Date) => Promise<void>;
  prevDay: () => void;
  nextDay: () => void;
  deleteBooking: (id: string) => Promise<void>;
  toggleDayBlock: () => Promise<void>;
  /** Resolves true when the block was created. */
  addTimeBlock: (input: TimeBlockInput) => Promise<boolean>;
  removeTimeBlock: (id: string) => Promise<void>;
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
  const dayBlocks = useSignal<AdminBlockedDate[]>([]);
  const blockErrorMessage = useSignal('');
  const monthCache = useSignal<Map<string, MonthCacheEntry>>(new Map());
  const inFlightMonthKey = useSignal<string | null>(null);
  const lastRefreshAt = useSignal(0);

  function monthKeyFromDate(date: Date): string {
    return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}`;
  }

  function dateKeyFromDate(date: Date): string {
    return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
  }

  function cloneCache(): Map<string, MonthCacheEntry> {
    return new Map(monthCache.value);
  }

  function clearVisibleDay(): void {
    reservations.value = [];
    guestCount.value = 0;
    isDayBlocked.value = false;
    dayBlocks.value = [];
  }

  function applyVisibleDay(date: Date): void {
    const entry = monthCache.value.get(monthKeyFromDate(date));
    if (!entry) {
      clearVisibleDay();
      return;
    }
    const dateKey = dateKeyFromDate(date);
    const dayReservations = entry.reservationsByDate.get(dateKey) ?? [];
    const dayBlockedRows = entry.blockedRowsByDate.get(dateKey) ?? [];
    reservations.value = dayReservations;
    guestCount.value = dayReservations.reduce((sum, row) => sum + (row.guests || 0), 0);
    isDayBlocked.value = dayBlockedRows.some((row) => row.start_time === null);
    dayBlocks.value = dayBlockedRows
      .filter((row) => row.start_time !== null)
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  }

  /** Replaces the cached blocked rows for `date` (the day the request was made for) and re-renders the visible day. */
  function updateBlockedRows(date: Date, update: (rows: AdminBlockedDate[]) => AdminBlockedDate[]): void {
    const monthKey = monthKeyFromDate(date);
    const dateKey = dateKeyFromDate(date);
    const entry = monthCache.value.get(monthKey);
    if (entry) {
      const blockedRowsByDate = new Map(entry.blockedRowsByDate);
      blockedRowsByDate.set(dateKey, update(entry.blockedRowsByDate.get(dateKey) ?? []));
      const nextCache = cloneCache();
      nextCache.set(monthKey, { ...entry, blockedRowsByDate });
      monthCache.value = nextCache;
    }
    applyVisibleDay(currentDate.value);
  }

  function buildMonthEntry(monthReservations: Reservation[], monthBlockedRows: AdminBlockedDate[]): MonthCacheEntry {
    const reservationsByDate = new Map<string, Reservation[]>();
    const blockedRowsByDate = new Map<string, AdminBlockedDate[]>();

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
      const monthBlockedRows = (await blockedRes.json()) as AdminBlockedDate[];
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
    if (requestedDateKey !== currentDateKey) blockErrorMessage.value = '';

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
    blockErrorMessage.value = '';
    if (monthCache.value.has(monthKeyFromDate(date))) {
      applyVisibleDay(date);
      return;
    }
    clearVisibleDay();
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

  /** Runs a blocked-dates request for the visible day, tracking the loading and error state. Resolves true on success. */
  async function saveBlockChange(request: (token: string, date: Date) => Promise<boolean>): Promise<boolean> {
    const tok = getToken();
    if (!tok) return false;

    isBlockLoading.value = true;
    blockErrorMessage.value = '';
    try {
      const saved = await request(tok, currentDate.value);
      if (!saved) blockErrorMessage.value = BLOCK_SAVE_ERROR;
      return saved;
    } catch {
      blockErrorMessage.value = BLOCK_SAVE_ERROR;
      return false;
    } finally {
      isBlockLoading.value = false;
    }
  }

  async function createBlock(token: string, date: Date, times: Partial<TimeBlockInput>): Promise<boolean> {
    const res = await adminFetch('/api/admin/blocked-dates', token, {
      method: 'POST',
      body: JSON.stringify({ date: dateKeyFromDate(date), ...times }),
    });
    if (!res.ok) return false;

    const created = (await res.json()) as AdminBlockedDate;
    updateBlockedRows(date, (rows) => [...rows, created]);
    return true;
  }

  async function toggleDayBlock(): Promise<void> {
    if (!isDayBlocked.value) {
      await saveBlockChange((tok, date) => createBlock(tok, date, {}));
      return;
    }

    await saveBlockChange(async (tok, date) => {
      const res = await adminFetch(`/api/admin/blocked-dates/date/${dateKeyFromDate(date)}`, tok, { method: 'DELETE' });
      if (!res.ok) return false;

      updateBlockedRows(date, (rows) => rows.filter((row) => row.start_time !== null));
      return true;
    });
  }

  async function addTimeBlock({ start_time, end_time, reason }: TimeBlockInput): Promise<boolean> {
    const trimmedReason = reason?.trim();
    return saveBlockChange((tok, date) =>
      createBlock(tok, date, { start_time, end_time, ...(trimmedReason ? { reason: trimmedReason } : {}) }),
    );
  }

  async function removeTimeBlock(id: string): Promise<void> {
    await saveBlockChange(async (tok, date) => {
      const res = await adminFetch(`/api/admin/blocked-dates/${id}`, tok, { method: 'DELETE' });
      // 404 means the block is already gone (removed elsewhere), which is the outcome the admin wanted.
      if (!res.ok && res.status !== 404) return false;

      updateBlockedRows(date, (rows) => rows.filter((row) => row.id !== id));
      return true;
    });
  }

  async function refreshMonth(): Promise<void> {
    const now = Date.now();
    if (now - lastRefreshAt.value < REFRESH_COOLDOWN_MS) {
      return;
    }
    lastRefreshAt.value = now;
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
    dayBlocks,
    blockErrorMessage,
    fetchBookings,
    prevDay,
    nextDay,
    deleteBooking,
    toggleDayBlock,
    addTimeBlock,
    removeTimeBlock,
    refreshMonth,
  };
}
