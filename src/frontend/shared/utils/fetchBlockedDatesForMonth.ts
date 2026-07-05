import type { BlockedDatesResponse } from '@shared/types';

type BlockedDatesCacheData = {
  adminBlocked: Set<string>;
  closed: Set<string>;
};

type CacheEntry = {
  data: BlockedDatesCacheData;
  fetchedAt: number;
};

type FetchResult = {
  adminBlocked: Set<string>;
  closed: Set<string>;
  aborted: boolean;
  error: boolean;
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;
let abortController: AbortController | null = null;

const emptyResult = (overrides: Partial<FetchResult> = {}): FetchResult => ({
  adminBlocked: new Set(),
  closed: new Set(),
  aborted: false,
  error: false,
  ...overrides,
});

export function bustMonth(tenantId: string, year: number, month: number): void {
  cache.delete(`${tenantId}:${year}-${String(month + 1).padStart(2, '0')}`);
}

export async function fetchBlockedDatesForMonth(
  tenantId: string,
  year: number,
  month: number,
  forceFresh = false,
): Promise<FetchResult> {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const key = `${tenantId}:${monthStr}`;
  const cached = cache.get(key);
  if (!forceFresh && cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return { ...cached.data, aborted: false, error: false };
  }

  if (abortController) abortController.abort();
  abortController = new AbortController();

  const fetchOptions: RequestInit = { signal: abortController.signal };
  if (forceFresh) fetchOptions.cache = 'no-store';

  try {
    const res = await fetch(
      `/api/reservations/blocked-dates?tenant_id=${encodeURIComponent(tenantId)}&month=${monthStr}`,
      fetchOptions,
    );
    if (!res.ok) return emptyResult({ error: true });
    const data = (await res.json()) as BlockedDatesResponse;
    const adminBlocked = new Set<string>(data.blocked_dates ?? []);
    const closed = new Set<string>(data.closed_dates ?? []);
    cache.set(key, { data: { adminBlocked, closed }, fetchedAt: Date.now() });
    return { adminBlocked, closed, aborted: false, error: false };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return emptyResult({ aborted: true });
    }
    return emptyResult({ error: true });
  }
}
