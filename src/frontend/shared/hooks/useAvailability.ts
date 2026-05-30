import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { CalendarDate } from '@shared/types';
import { formatDateForAPI } from '@shared/utils';
import type { BlockedDatesResponse, BlockedTimesResponse, DailyCapacityResponse } from '@shared/types';

interface UseAvailabilityReturn {
  blockedDates: Signal<Set<string>>;
  blockedTimes: Signal<string[]>;
  dailyCapacity: Signal<DailyCapacityResponse | null>;
  isFetchingTimes: Signal<boolean>;
  fetchBlockedDates: (tenantId: string, year: number, month: number) => Promise<void>;
  fetchBlockedTimes: (tenantId: string, date: CalendarDate, guests: number) => Promise<void>;
  fetchDailyCapacity: (tenantId: string, date: CalendarDate) => Promise<void>;
}

export function useAvailability(): UseAvailabilityReturn {
  const blockedDates = useSignal<Set<string>>(new Set());
  const blockedTimes = useSignal<string[]>([]);
  const dailyCapacity = useSignal<DailyCapacityResponse | null>(null);
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

  async function fetchDailyCapacity(tenantId: string, date: CalendarDate): Promise<void> {
    try {
      const dateStr = formatDateForAPI(date);
      const res = await fetch(`/api/reservations/daily-capacity?tenant_id=${encodeURIComponent(tenantId)}&date=${dateStr}`);
      if (!res.ok) { dailyCapacity.value = null; return; }
      dailyCapacity.value = await res.json() as DailyCapacityResponse;
    } catch {
      dailyCapacity.value = null;
    }
  }

  return { blockedDates, blockedTimes, dailyCapacity, isFetchingTimes, fetchBlockedDates, fetchBlockedTimes, fetchDailyCapacity };
}
