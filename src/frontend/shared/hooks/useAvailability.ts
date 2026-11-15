import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { CalendarDate } from '@shared/types';
import { fetchBlockedDatesForMonth, bustMonth } from '@shared/utils/fetchBlockedDatesForMonth';
import { fetchBlockedTimes as sharedFetchBlockedTimes } from '@shared/utils/fetchBlockedTimes';

export { bustMonth as bustBlockedDatesCache } from '@shared/utils/fetchBlockedDatesForMonth';
export { bustBlockedTimesCache } from '@shared/utils/fetchBlockedTimes';

type UseAvailabilityReturn = {
  blockedDates: Signal<Set<string>>;
  closedDates: Signal<Set<string>>;
  blockedDatesError: Signal<string>;
  isFetchingDates: Signal<boolean>;
  blockedTimes: Signal<string[]>;
  /** The selected date's bookable start times from the server, or null to fall back to the weekly hours. */
  daySlots: Signal<string[] | null>;
  isFetchingTimes: Signal<boolean>;
  fetchBlockedDates: (tenantId: string, year: number, month: number, forceFresh?: boolean) => Promise<void>;
  fetchBlockedTimes: (tenantId: string, date: CalendarDate, guests: number, maxCovers?: number) => Promise<void>;
};

export function useAvailability(): UseAvailabilityReturn {
  const blockedDates = useSignal<Set<string>>(new Set());
  const closedDates = useSignal<Set<string>>(new Set());
  const blockedDatesError = useSignal('');
  const isFetchingDates = useSignal(false);
  const blockedTimes = useSignal<string[]>([]);
  const daySlots = useSignal<string[] | null>(null);
  const isFetchingTimes = useSignal(false);

  async function fetchBlockedDates(tenantId: string, year: number, month: number, forceFresh = false): Promise<void> {
    isFetchingDates.value = true;
    blockedDatesError.value = '';
    try {
      const { adminBlocked, closed, aborted, error } = await fetchBlockedDatesForMonth(tenantId, year, month, forceFresh);
      if (aborted) return;
      if (error) {
        blockedDatesError.value = 'Could not load availability. Please try again.';
        return;
      }
      blockedDates.value = adminBlocked;
      closedDates.value = closed;
    } finally {
      isFetchingDates.value = false;
    }
  }

  async function fetchBlockedTimes(tenantId: string, date: CalendarDate, guests: number, maxCovers = 0): Promise<void> {
    isFetchingTimes.value = true;
    try {
      const result = await sharedFetchBlockedTimes({ tenantId, date, guests, maxCovers });
      if (result.aborted) return;
      blockedTimes.value = result.blockedTimes;
      daySlots.value = result.daySlots;
    } finally {
      isFetchingTimes.value = false;
    }
  }

  return {
    blockedDates,
    closedDates,
    blockedDatesError,
    isFetchingDates,
    blockedTimes,
    daySlots,
    isFetchingTimes,
    fetchBlockedDates,
    fetchBlockedTimes,
  };
}
