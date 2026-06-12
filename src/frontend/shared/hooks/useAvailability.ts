import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { CalendarDate } from '@shared/types';
import { formatDateForAPI } from '@shared/utils';
import type { BlockedDatesResponse, BlockedTimesResponse } from '@shared/types';

interface UseAvailabilityReturn {
  blockedDates: Signal<Set<string>>;
  blockedTimes: Signal<string[]>;
  isFetchingTimes: Signal<boolean>;
  fetchBlockedDates: (tenantId: string, year: number, month: number) => Promise<void>;
  fetchBlockedTimes: (tenantId: string, date: CalendarDate, guests: number) => Promise<void>;
}

export function useAvailability(): UseAvailabilityReturn {
  const blockedDates = useSignal<Set<string>>(new Set());
  const blockedTimes = useSignal<string[]>([]);
  const isFetchingTimes = useSignal(false);

  async function fetchBlockedDates(tenantId: string, year: number, month: number): Promise<void> {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    try {
      const res = await fetch(`/api/reservations/blocked-dates?tenant_id=${encodeURIComponent(tenantId)}&month=${monthStr}`);
      if (!res.ok) { blockedDates.value = new Set(); return; }
      const data = await res.json() as BlockedDatesResponse;
      blockedDates.value = new Set(data.blocked_dates ?? []);
    } catch {
      blockedDates.value = new Set();
    }
  }

  async function fetchBlockedTimes(tenantId: string, date: CalendarDate, guests: number): Promise<void> {
    isFetchingTimes.value = true;
    try {
      const dateStr = formatDateForAPI(date);
      const res = await fetch(`/api/reservations/blocked-times?tenant_id=${encodeURIComponent(tenantId)}&date=${dateStr}&guests=${guests}`);
      if (!res.ok) { blockedTimes.value = []; return; }
      const data = await res.json() as BlockedTimesResponse;
      blockedTimes.value = data.blocked_times ?? [];
    } catch {
      blockedTimes.value = [];
    } finally {
      isFetchingTimes.value = false;
    }
  }

  return { blockedDates, blockedTimes, isFetchingTimes, fetchBlockedDates, fetchBlockedTimes };
}
