import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { Alert, Button, Calendar, Card, Join, Loading, Status } from '@shared/components/ui';
import { ChevronLeft, ChevronRight } from '@shared/components/ui/icons';
import { cx } from '@shared/utils/cx';
import { MONTH_NAMES } from '@constants';
import { adminFetch } from '@shared/utils/adminFetch';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function toMonthStr(y: number, m: number): string {
  return `${y}-${pad(m + 1)}`;
}

type RangePoint = {
  y: number;
  m: number;
  d: number;
  unblockMode: boolean;
};

type BlockedDatesSettingsProps = {
  token: string;
};

const BlockedDatesSettings: FunctionComponent<BlockedDatesSettingsProps> = ({ token }) => {
  const viewYear = useSignal(new Date().getFullYear());
  const viewMonth = useSignal(new Date().getMonth());
  const blockedSet = useSignal<Set<string>>(new Set());
  const rangeStart = useSignal<RangePoint | null>(null);
  const hoverDate = useSignal<RangePoint | null>(null);
  const isLoading = useSignal(false);
  const errorMessage = useSignal('');

  useEffect(() => {
    loadMonth(viewYear.value, viewMonth.value);
  }, []);

  function showError(msg: string) {
    errorMessage.value = msg;
    setTimeout(() => {
      errorMessage.value = '';
    }, 5000);
  }

  async function loadMonth(y: number, m: number) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const r = await adminFetch(`/api/admin/blocked-dates?month=${toMonthStr(y, m)}`, token);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as Array<{ date: string; start_time: string | null }>;
      blockedSet.value = new Set((data || []).filter((b) => !b.start_time).map((b) => b.date));
    } catch {
      showError('Failed to load blocked dates.');
    } finally {
      isLoading.value = false;
    }
  }

  function prevMonth() {
    rangeStart.value = null;
    hoverDate.value = null;
    let m = viewMonth.value - 1;
    let y = viewYear.value;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    viewMonth.value = m;
    viewYear.value = y;
    loadMonth(y, m);
  }

  function nextMonth() {
    rangeStart.value = null;
    hoverDate.value = null;
    let m = viewMonth.value + 1;
    let y = viewYear.value;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    viewMonth.value = m;
    viewYear.value = y;
    loadMonth(y, m);
  }

  async function handleDayClick(y: number, m: number, d: number) {
    if (isLoading.value) return;
    const start = rangeStart.value;
    if (!start) {
      rangeStart.value = { y, m, d, unblockMode: isBlockedFn(y, m, d) };
      return;
    }
    rangeStart.value = null;
    hoverDate.value = null;
    if (start.y === y && start.m === m && start.d === d) {
      await toggleDay(y, m, d);
    } else if (start.y === y && start.m === m) {
      if (start.unblockMode) {
        await unblockRange(y, m, Math.min(start.d, d), Math.max(start.d, d));
        return;
      }

      await blockRange(y, m, Math.min(start.d, d), Math.max(start.d, d));
    } else {
      await toggleDay(y, m, d);
    }
  }

  async function toggleDay(y: number, m: number, d: number) {
    const dateStr = toDateStr(y, m, d);
    if (blockedSet.value.has(dateStr)) {
      await unblockDay(dateStr);
    } else {
      await blockDay(dateStr);
    }
  }

  async function blockDay(dateStr: string) {
    isLoading.value = true;
    try {
      const r = await adminFetch('/api/admin/blocked-dates', token, {
        method: 'POST',
        body: JSON.stringify({ date: dateStr }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      blockedSet.value = new Set([...blockedSet.value, dateStr]);
    } catch {
      showError('Failed to block date.');
    } finally {
      isLoading.value = false;
    }
  }

  async function unblockDay(dateStr: string) {
    isLoading.value = true;
    try {
      const r = await adminFetch(`/api/admin/blocked-dates/date/${dateStr}`, token, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const next = new Set(blockedSet.value);
      next.delete(dateStr);
      blockedSet.value = next;
    } catch {
      showError('Failed to unblock date.');
    } finally {
      isLoading.value = false;
    }
  }

  async function blockRange(y: number, m: number, startDay: number, endDay: number) {
    isLoading.value = true;
    try {
      const ops: Promise<void>[] = [];
      for (let d = startDay; d <= endDay; d++) {
        const dateStr = toDateStr(y, m, d);
        if (blockedSet.value.has(dateStr)) continue;
        ops.push(
          adminFetch('/api/admin/blocked-dates', token, {
            method: 'POST',
            body: JSON.stringify({ date: dateStr }),
          }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            blockedSet.value = new Set([...blockedSet.value, dateStr]);
          }),
        );
      }
      await Promise.all(ops);
    } catch {
      showError('Failed to block some dates.');
    } finally {
      isLoading.value = false;
    }
  }

  async function unblockRange(y: number, m: number, startDay: number, endDay: number) {
    isLoading.value = true;
    try {
      const ops: Promise<void>[] = [];
      for (let d = startDay; d <= endDay; d++) {
        const dateStr = toDateStr(y, m, d);
        if (!blockedSet.value.has(dateStr)) continue;
        ops.push(
          adminFetch(`/api/admin/blocked-dates/date/${dateStr}`, token, { method: 'DELETE' }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const next = new Set(blockedSet.value);
            next.delete(dateStr);
            blockedSet.value = next;
          }),
        );
      }
      await Promise.all(ops);
    } catch {
      showError('Failed to unblock some dates.');
    } finally {
      isLoading.value = false;
    }
  }

  const today = new Date();

  function isBlockedFn(y: number, m: number, d: number): boolean {
    return blockedSet.value.has(toDateStr(y, m, d));
  }

  function isRangeStartFn(y: number, m: number, d: number): boolean {
    const rs = rangeStart.value;
    return !!rs && rs.y === y && rs.m === m && rs.d === d;
  }

  function isRangeEndFn(y: number, m: number, d: number): boolean {
    const rs = rangeStart.value;
    const hd = hoverDate.value;
    if (!rs || !hd) return false;
    if (rs.y !== y || rs.m !== m) return false;
    if (hd.y !== y || hd.m !== m) return false;
    return d === hd.d && hd.d !== rs.d;
  }

  function isInRangeFn(y: number, m: number, d: number): boolean {
    const rs = rangeStart.value;
    const hd = hoverDate.value;
    if (!rs || !hd) return false;
    if (rs.y !== y || rs.m !== m) return false;
    if (hd.y !== y || hd.m !== m) return false;
    const lo = Math.min(rs.d, hd.d);
    const hi = Math.max(rs.d, hd.d);
    return d > lo && d < hi;
  }

  const isCurrent = viewYear.value === today.getFullYear() && viewMonth.value === today.getMonth();

  // The page title (Blocked dates) comes from AdminLayout's h1.
  return (
    <Card as="section" aria-labelledby="bd-month-title" bordered class="bg-base-100 max-w-[36rem] [--card-p:1rem]">
      {errorMessage.value && (
        <Alert variant="error" live="assertive">
          {errorMessage.value}
        </Alert>
      )}

      <div class="flex justify-center">
        <Join>
          <Button class="join-item" shape="square" aria-label="Previous month" disabled={isCurrent} onClick={prevMonth}>
            <ChevronLeft />
          </Button>
          <h2
            id="bd-month-title"
            class="join-item border-base-300 m-0 flex min-w-[11rem] items-center justify-center px-4 text-lg font-semibold"
          >
            {MONTH_NAMES[viewMonth.value]} {viewYear.value}
          </h2>
          <Button class="join-item" shape="square" aria-label="Next month" onClick={nextMonth}>
            <ChevronRight />
          </Button>
        </Join>
      </div>

      <div class="relative" aria-busy={isLoading.value}>
        {isLoading.value && (
          <p class="text-base-content/70 absolute inset-0 m-0 flex items-center justify-center gap-3">
            <Loading size="sm" label={null} />
            Loading…
          </p>
        )}
        <Calendar
          class={cx(isLoading.value && 'invisible')}
          year={viewYear.value}
          month={viewMonth.value}
          isBlocked={isBlockedFn}
          isRangeStart={isRangeStartFn}
          isInRange={isInRangeFn}
          isRangeEnd={isRangeEndFn}
          rangeMode={rangeStart.value?.unblockMode ? 'unblock' : 'block'}
          onSelect={handleDayClick}
          onHoverDate={(y, m, d) => {
            hoverDate.value = { y, m, d, unblockMode: rangeStart.value?.unblockMode ?? false };
          }}
          onMouseLeave={() => {
            hoverDate.value = null;
          }}
        />
      </div>

      {/* The swatches are decorative: each sits beside its own text. */}
      <div class="border-base-300 text-base-content/70 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-sm">
        <span class="flex items-center gap-2">
          {/* Drawn like a blocked day; `color` is required but the stripes cover it. */}
          <Status
            color="primary"
            size="xl"
            class="border-base-300 border opacity-55 bg-[repeating-linear-gradient(-45deg,var(--color-base-200),var(--color-base-200)_3px,var(--color-base-100)_3px,var(--color-base-100)_7px)]"
          />
          Blocked
        </span>
        <span class="flex items-center gap-2">
          <Status color="primary" size="xl" />
          Block range
        </span>
        <span class="flex items-center gap-2">
          <Status color="error" size="xl" />
          Unblock range
        </span>
        <span class="italic">Click to toggle · Click two days to block or unblock a range</span>
      </div>
    </Card>
  );
};

export default BlockedDatesSettings;
