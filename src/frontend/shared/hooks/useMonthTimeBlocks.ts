import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { AdminBlockedDate, AdminDateOverride, CalendarDate, SpecialHoursInput, TimeBlockInput } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import { formatDateForAPI, padTwo } from '@shared/utils/dates';

const SAVE_ERROR = 'Could not update the hours for this day. Please try again.';
const LOAD_ERROR = 'Could not load this month. Please try again.';

export type UseMonthTimeBlocksReturn = {
  viewYear: Signal<number>;
  /** 0-indexed: 0 = January */
  viewMonth: Signal<number>;
  /** The viewed month's time-range blocks (full-day blocks excluded), ordered by date then start time. */
  monthBlocks: Signal<AdminBlockedDate[]>;
  /** The viewed month's special opening hours, ordered by date. */
  monthOverrides: Signal<AdminDateOverride[]>;
  isFetching: Signal<boolean>;
  isSaving: Signal<boolean>;
  loadError: Signal<string>;
  saveError: Signal<string>;
  loadMonth: (year: number, month: number) => Promise<void>;
  /** Resolves true when the block was created. */
  addBlock: (date: CalendarDate, input: TimeBlockInput) => Promise<boolean>;
  removeBlock: (id: string) => Promise<void>;
  /** Sets (or replaces) the special opening hours for a date. Resolves true when saved. */
  setSpecialHours: (date: CalendarDate, input: SpecialHoursInput) => Promise<boolean>;
  /** Removes a date's special hours so its normal weekly hours apply again. `date` is YYYY-MM-DD. */
  removeSpecialHours: (date: string) => Promise<void>;
};

function sortBlocks(rows: AdminBlockedDate[]): AdminBlockedDate[] {
  return rows
    .filter((row) => row.start_time !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''));
}

/**
 * One month of the tenant's changed hours: time-range blocks and special opening hours, with add and
 * remove. Starts on the current month; nothing loads until `loadMonth` is called.
 */
export function useMonthTimeBlocks(token: string): UseMonthTimeBlocksReturn {
  const today = new Date();
  const viewYear = useSignal(today.getFullYear());
  const viewMonth = useSignal(today.getMonth());
  const monthBlocks = useSignal<AdminBlockedDate[]>([]);
  const monthOverrides = useSignal<AdminDateOverride[]>([]);
  const isFetching = useSignal(false);
  const isSaving = useSignal(false);
  const loadError = useSignal('');
  const saveError = useSignal('');

  async function loadMonth(year: number, month: number): Promise<void> {
    viewYear.value = year;
    viewMonth.value = month;
    saveError.value = '';
    loadError.value = '';
    isFetching.value = true;
    try {
      const monthKey = `${year}-${padTwo(month + 1)}`;
      const [blocksRes, overridesRes] = await Promise.all([
        adminFetch(`/api/admin/blocked-dates?month=${monthKey}`, token),
        adminFetch(`/api/admin/date-overrides?month=${monthKey}`, token),
      ]);
      if (!blocksRes.ok || !overridesRes.ok) throw new Error('Failed to load month');
      const rows = (await blocksRes.json()) as AdminBlockedDate[];
      const overrides = ((await overridesRes.json()) as { data?: AdminDateOverride[] }).data ?? [];
      // A slower response for a month the admin has already left must not replace the visible one.
      if (viewYear.value === year && viewMonth.value === month) {
        monthBlocks.value = sortBlocks(rows);
        monthOverrides.value = overrides;
      }
    } catch {
      loadError.value = LOAD_ERROR;
    } finally {
      isFetching.value = false;
    }
  }

  async function save(request: () => Promise<boolean>): Promise<boolean> {
    isSaving.value = true;
    saveError.value = '';
    try {
      const saved = await request();
      if (!saved) saveError.value = SAVE_ERROR;
      return saved;
    } catch {
      saveError.value = SAVE_ERROR;
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  async function addBlock(date: CalendarDate, { start_time, end_time, reason }: TimeBlockInput): Promise<boolean> {
    const trimmedReason = reason?.trim();
    return save(async () => {
      const res = await adminFetch('/api/admin/blocked-dates', token, {
        method: 'POST',
        body: JSON.stringify({ date: formatDateForAPI(date), start_time, end_time, ...(trimmedReason ? { reason: trimmedReason } : {}) }),
      });
      if (!res.ok) return false;

      const created = (await res.json()) as AdminBlockedDate;
      monthBlocks.value = sortBlocks([...monthBlocks.value, created]);
      return true;
    });
  }

  async function removeBlock(id: string): Promise<void> {
    await save(async () => {
      const res = await adminFetch(`/api/admin/blocked-dates/${id}`, token, { method: 'DELETE' });
      // 404 means the block is already gone (removed elsewhere), which is the outcome the admin wanted.
      if (!res.ok && res.status !== 404) return false;

      monthBlocks.value = monthBlocks.value.filter((row) => row.id !== id);
      return true;
    });
  }

  async function setSpecialHours(date: CalendarDate, { open_time, close_time, reason }: SpecialHoursInput): Promise<boolean> {
    const dateKey = formatDateForAPI(date);
    const trimmedReason = reason?.trim();
    return save(async () => {
      const res = await adminFetch(`/api/admin/date-overrides/${dateKey}`, token, {
        method: 'PUT',
        body: JSON.stringify({ is_closed: false, open_time, close_time, ...(trimmedReason ? { reason: trimmedReason } : {}) }),
      });
      if (!res.ok) return false;

      const saved = ((await res.json()) as { data: AdminDateOverride }).data;
      monthOverrides.value = [...monthOverrides.value.filter((row) => row.date !== dateKey), saved].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      return true;
    });
  }

  async function removeSpecialHours(date: string): Promise<void> {
    await save(async () => {
      const res = await adminFetch(`/api/admin/date-overrides/${date}`, token, { method: 'DELETE' });
      // 404 means the special hours are already gone, which is the outcome the admin wanted.
      if (!res.ok && res.status !== 404) return false;

      monthOverrides.value = monthOverrides.value.filter((row) => row.date !== date);
      return true;
    });
  }

  return {
    viewYear,
    viewMonth,
    monthBlocks,
    monthOverrides,
    isFetching,
    isSaving,
    loadError,
    saveError,
    loadMonth,
    addBlock,
    removeBlock,
    setSpecialHours,
    removeSpecialHours,
  };
}
