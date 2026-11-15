import type { BlockedTimesResponse, CalendarDate } from '@shared/types';
import { formatDateForAPI } from '@shared/utils';

type DayAvailability = {
  blockedTimes: string[];
  /** The date's bookable start times as resolved by the server, or null when it did not say (use the weekly hours). */
  daySlots: string[] | null;
};

type CacheEntry = {
  data: DayAvailability;
  fetchedAt: number;
};

const NO_AVAILABILITY: DayAvailability = { blockedTimes: [], daySlots: null };

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 1000;
let abortController: AbortController | null = null;

export function bustBlockedTimesCache(tenantId: string, date: CalendarDate): void {
  const dateStr = formatDateForAPI(date);
  const prefix = `bt:${tenantId}:${dateStr}`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

type FetchBlockedTimesOptions = {
  tenantId: string;
  date: CalendarDate;
  guests: number;
  maxCovers: number;
};

export async function fetchBlockedTimes({
  tenantId,
  date,
  guests,
  maxCovers,
}: FetchBlockedTimesOptions): Promise<DayAvailability & { aborted: boolean; error: boolean }> {
  const dateStr = formatDateForAPI(date);
  const cacheKey = maxCovers === 0 ? `bt:${tenantId}:${dateStr}` : `bt:${tenantId}:${dateStr}:${guests}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return { ...cached.data, aborted: false, error: false };
  }

  if (abortController) abortController.abort();
  abortController = new AbortController();

  try {
    const res = await fetch(`/api/reservations/blocked-times?tenant_id=${encodeURIComponent(tenantId)}&date=${dateStr}&guests=${guests}`, {
      signal: abortController.signal,
    });
    if (!res.ok) return { ...NO_AVAILABILITY, aborted: false, error: true };

    const data = (await res.json()) as BlockedTimesResponse;
    const result: DayAvailability = { blockedTimes: data.blocked_times ?? [], daySlots: data.slots ?? null };
    cache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    return { ...result, aborted: false, error: false };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ...NO_AVAILABILITY, aborted: true, error: false };
    }
    return { ...NO_AVAILABILITY, aborted: false, error: true };
  }
}
