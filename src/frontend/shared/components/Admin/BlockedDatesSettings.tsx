import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { CalendarGrid } from '@shared/components';
import { MONTHS } from '@shared/types';
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

interface RangePoint {
  y: number;
  m: number;
  d: number;
}

interface BlockedDatesSettingsProps {
  token: string;
}

const BlockedDatesSettings: FunctionComponent<BlockedDatesSettingsProps> = ({ token }) => {
  const viewYear  = useSignal(new Date().getFullYear());
  const viewMonth = useSignal(new Date().getMonth());
  const blockedSet = useSignal<Set<string>>(new Set());
  const rangeStart = useSignal<RangePoint | null>(null);
  const hoverDate  = useSignal<RangePoint | null>(null);
  const isLoading  = useSignal(false);
  const errorMessage = useSignal('');

  useEffect(() => {
    loadMonth(viewYear.value, viewMonth.value);
  }, []);

  function showError(msg: string) {
    errorMessage.value = msg;
    setTimeout(() => { errorMessage.value = ''; }, 5000);
  }

  async function loadMonth(y: number, m: number) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const r = await adminFetch(`/api/admin/blocked-dates?month=${toMonthStr(y, m)}`, token);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as Array<{ date: string; start_time: string | null }>;
      blockedSet.value = new Set(
        (data || []).filter(b => !b.start_time).map(b => b.date)
      );
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
    if (m < 0) { m = 11; y -= 1; }
    viewMonth.value = m;
    viewYear.value = y;
    loadMonth(y, m);
  }

  function nextMonth() {
    rangeStart.value = null;
    hoverDate.value = null;
    let m = viewMonth.value + 1;
    let y = viewYear.value;
    if (m > 11) { m = 0; y += 1; }
    viewMonth.value = m;
    viewYear.value = y;
    loadMonth(y, m);
  }

  async function handleDayClick(y: number, m: number, d: number) {
    if (isLoading.value) return;
    const start = rangeStart.value;
    if (!start) {
      rangeStart.value = { y, m, d };
      return;
    }
    rangeStart.value = null;
    hoverDate.value = null;
    if (start.y === y && start.m === m && start.d === d) {
      await toggleDay(y, m, d);
    } else if (start.y === y && start.m === m) {
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
          }).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            blockedSet.value = new Set([...blockedSet.value, dateStr]);
          })
        );
      }
      await Promise.all(ops);
    } catch {
      showError('Failed to block some dates.');
    } finally {
      isLoading.value = false;
    }
  }

  const today = new Date();

  function isDisabled(y: number, m: number, d: number): boolean {
    if (y !== today.getFullYear()) return y < today.getFullYear();
    if (m !== today.getMonth()) return m < today.getMonth();
    return d < today.getDate();
  }

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

  return (
    <div class="bd-settings">
      <h3 class="bd-section-title">Blocked Dates</h3>
      {errorMessage.value && (
        <div class="error-text" role="alert">{errorMessage.value}</div>
      )}
      <div class="date-picker-popup date-picker-popup--inline">
        <div class="date-picker-header">
          <button
            class="bd-prev-btn"
            aria-label="Previous month"
            disabled={isCurrent}
            onClick={prevMonth}
          >
            &#8592;
          </button>
          <span class="bd-month-label">
            {MONTHS[viewMonth.value]} {viewYear.value}
          </span>
          <button class="bd-next-btn" aria-label="Next month" onClick={nextMonth}>
            &#8594;
          </button>
        </div>
        {isLoading.value && (
          <div class="bd-calendar-loading loading-text">Loading…</div>
        )}
        <div style={isLoading.value ? 'visibility:hidden' : undefined}>
          <CalendarGrid
            year={viewYear.value}
            month={viewMonth.value}
            isDisabled={isDisabled}
            isBlocked={isBlockedFn}
            isRangeStart={isRangeStartFn}
            isInRange={isInRangeFn}
            isRangeEnd={isRangeEndFn}
            onSelect={handleDayClick}
            onHoverDate={(y, m, d) => { hoverDate.value = { y, m, d }; }}
            onLeaveGrid={() => { hoverDate.value = null; }}
          />
        </div>
        <div class="bd-legend">
          <span class="bd-legend-item">
            <span class="bd-legend-swatch bd-legend-swatch--blocked" /> Blocked
          </span>
          <span class="bd-legend-item bd-legend-hint">
            ◌ Click to toggle · Click two days to block a range
          </span>
        </div>
      </div>
    </div>
  );
};

export default BlockedDatesSettings;
