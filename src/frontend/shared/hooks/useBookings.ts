import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Reservation } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateToString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface UseBookingsReturn {
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
}

export function useBookings(getToken: () => string | null): UseBookingsReturn {
  const currentDate = useSignal(new Date());
  const reservations = useSignal<Reservation[]>([]);
  const isLoading = useSignal(false);
  const errorMessage = useSignal('');
  const guestCount = useSignal(0);
  const isDayBlocked = useSignal(false);
  const isBlockLoading = useSignal(false);

  useEffect(() => {
    fetchBookings(currentDate.value);
  }, []);

  async function fetchBookings(date: Date): Promise<void> {
    const tok = getToken();
    if (!tok) return;
    isLoading.value = true;
    errorMessage.value = '';
    const dateStr = dateToString(date);
    try {
      const r = await adminFetch(`/api/admin/reservations?date=${dateStr}`, tok);
      if (!r.ok) {
        errorMessage.value = `Failed to load bookings (HTTP ${r.status})`;
        return;
      }
      const data = await r.json() as Reservation[];
      reservations.value = data;
      guestCount.value = data.reduce((sum, r) => sum + (r.guests || 0), 0);
      await fetchBlockState(dateStr, tok);
    } catch {
      errorMessage.value = 'Failed to load bookings. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchBlockState(dateStr: string, tok: string): Promise<void> {
    try {
      const r = await adminFetch(`/api/admin/blocked-dates?date=${dateStr}`, tok);
      if (!r.ok) { isDayBlocked.value = false; return; }
      const data = await r.json() as Array<{ start_time: string | null }>;
      isDayBlocked.value = (data || []).some(b => b.start_time === null);
    } catch {
      isDayBlocked.value = false;
    }
  }

  function prevDay(): void {
    const d = new Date(currentDate.value);
    d.setDate(d.getDate() - 1);
    currentDate.value = d;
    fetchBookings(d);
  }

  function nextDay(): void {
    const d = new Date(currentDate.value);
    d.setDate(d.getDate() + 1);
    currentDate.value = d;
    fetchBookings(d);
  }

  async function deleteBooking(id: string): Promise<void> {
    const tok = getToken();
    if (!tok) return;
    const r = await adminFetch(`/api/admin/reservations/${id}`, tok, { method: 'DELETE' });
    if (r.ok) {
      await fetchBookings(currentDate.value);
    }
  }

  async function toggleDayBlock(): Promise<void> {
    const tok = getToken();
    if (!tok) return;
    isBlockLoading.value = true;
    const dateStr = dateToString(currentDate.value);
    try {
      if (isDayBlocked.value) {
        const r = await adminFetch(`/api/admin/blocked-dates/date/${dateStr}`, tok, { method: 'DELETE' });
        if (r.ok) isDayBlocked.value = false;
      } else {
        const r = await adminFetch('/api/admin/blocked-dates', tok, {
          method: 'POST',
          body: JSON.stringify({ date: dateStr }),
        });
        if (r.ok) isDayBlocked.value = true;
      }
    } finally {
      isBlockLoading.value = false;
    }
  }

  return {
    currentDate, reservations, isLoading, errorMessage,
    guestCount, isDayBlocked, isBlockLoading,
    fetchBookings, prevDay, nextDay, deleteBooking, toggleDayBlock,
  };
}
