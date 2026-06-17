import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { CalendarDate } from '@shared/types';
import { formatDateForAPI } from '@shared/utils';
import type { BlockedDatesResponse, BlockedTimesResponse } from '@shared/types';

interface UseAvailabilityReturn {
  blockedDates: Signal<Set<string>>;
  blockedDatesError: Signal<string>;
  isFetchingDates: Signal<boolean>;
  blockedTimes: Signal<string[]>;
  isFetchingTimes: Signal<boolean>;
  fetchBlockedDates: (tenantId: string, year: number, month: number) => Promise<void>;
  fetchBlockedTimes: (tenantId: string, date: CalendarDate, guests: number) => Promise<void>;
}

export function useAvailability(): UseAvailabilityReturn {
  const blockedDates = useSignal<Set<string>>(new Set());
  const blockedDatesError = useSignal('');
  const isFetchingDates = useSignal(false);
  const blockedTimes = useSignal<string[]>([]);
  const isFetchingTimes = useSignal(false);
  let blockedTimesAbortController: AbortController | null = null;

  async function fetchBlockedDates(tenantId: string, year: number, month: number): Promise<void> {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    blockedDatesError.value = '';
    isFetchingDates.value = true;
    try {
      const res = await fetch(`/api/reservations/blocked-dates?tenant_id=${encodeURIComponent(tenantId)}&month=${monthStr}`);
      if (!res.ok) {
        blockedDatesError.value = 'Could not load availability. Please try again.';
        return;
      }
      const data = await res.json() as BlockedDatesResponse;
      blockedDates.value = new Set(data.blocked_dates ?? []);
    } catch {
      blockedDatesError.value = 'Could not load availability. Please try again.';
    } finally {
      isFetchingDates.value = false;
    }
  }

  async function fetchBlockedTimes(tenantId: string, date: CalendarDate, guests: number): Promise<void> {
    if (blockedTimesAbortController) {
      blockedTimesAbortController.abort();
    }
    blockedTimesAbortController = new AbortController();
    const { signal } = blockedTimesAbortController;

    isFetchingTimes.value = true;
    try {
      const dateStr = formatDateForAPI(date);
      const res = await fetch(`/api/reservations/blocked-times?tenant_id=${encodeURIComponent(tenantId)}&date=${dateStr}&guests=${guests}`, { signal });
      if (!res.ok) { blockedTimes.value = []; return; }
      const data = await res.json() as BlockedTimesResponse;
      blockedTimes.value = data.blocked_times ?? [];
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      blockedTimes.value = [];
    } finally {
      isFetchingTimes.value = false;
    }
  }

  return { blockedDates, blockedDatesError, isFetchingDates, blockedTimes, isFetchingTimes, fetchBlockedDates, fetchBlockedTimes };
}
