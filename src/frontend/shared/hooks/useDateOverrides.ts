import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { AdminDateOverride } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';

export type UseDateOverridesReturn = {
  /** Special opening hours keyed by date (YYYY-MM-DD), for every month loaded so far. */
  overridesByDate: Signal<Map<string, AdminDateOverride>>;
  /** Loads a month (YYYY-MM) once; pass `force` to load it again. A failed load leaves earlier data in place. */
  loadMonth: (monthKey: string, force?: boolean) => Promise<void>;
};

/** Read-only special opening hours for the admin day view. */
export function useDateOverrides(getToken: () => string | null): UseDateOverridesReturn {
  const overridesByDate = useSignal<Map<string, AdminDateOverride>>(new Map());
  const loadedMonths = useSignal<Set<string>>(new Set());

  async function loadMonth(monthKey: string, force = false): Promise<void> {
    const tok = getToken();
    if (!tok || (!force && loadedMonths.value.has(monthKey))) return;

    loadedMonths.value = new Set([...loadedMonths.value, monthKey]);
    try {
      const res = await adminFetch(`/api/admin/date-overrides?month=${monthKey}`, tok);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rows = ((await res.json()) as { data?: AdminDateOverride[] }).data ?? [];
      const otherMonths = [...overridesByDate.value].filter(([date]) => !date.startsWith(monthKey));
      overridesByDate.value = new Map([...otherMonths, ...rows.map((row): [string, AdminDateOverride] => [row.date, row])]);
    } catch {
      // Let a later visit to this month try again.
      loadedMonths.value = new Set([...loadedMonths.value].filter((key) => key !== monthKey));
    }
  }

  return { overridesByDate, loadMonth };
}
