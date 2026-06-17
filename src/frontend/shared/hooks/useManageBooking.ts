import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Reservation, TenantConfig, CalendarDate } from '@shared/types';
import type { ManageView, EditData } from '@shared/types';
import { formatDateForAPI, getAvailableSlots } from '@shared/utils';

export interface UseManageBookingReturn {
  view: Signal<ManageView>;
  reservation: Signal<Reservation | null>;
  tenantConfig: Signal<TenantConfig | null>;
  errorMessage: Signal<string>;
  editData: Signal<EditData | null>;
  calYear: Signal<number>;
  calMonth: Signal<number>;
  selectedDate: Signal<CalendarDate | null>;
  selectedTime: Signal<string>;
  blockedDates: Signal<Set<string>>;
  blockedTimes: Signal<string[]>;
  isFetchingTimes: Signal<boolean>;
  goToOverview: () => void;
  goToEditDetails: () => void;
  goToChangeDatetime: () => Promise<void>;
  goToCancelConfirm: () => void;
  saveEditDetails: (data: EditData) => Promise<void>;
  saveDatetime: () => Promise<void>;
  confirmCancel: () => Promise<void>;
  fetchBlockedDatesForMonth: (year: number, month: number) => Promise<void>;
  fetchBlockedTimesForDate: (date: CalendarDate) => Promise<void>;
  selectDate: (year: number, month: number, day: number) => Promise<void>;
}

export function useManageBooking(reservationId: string | null, bookingEmail: string | null, bookingToken: string | null): UseManageBookingReturn {
  const view = useSignal<ManageView>('loading');
  const reservation = useSignal<Reservation | null>(null);
  const tenantConfig = useSignal<TenantConfig | null>(null);
  const errorMessage = useSignal('');
  const editData = useSignal<EditData | null>(null);
  const calYear = useSignal(new Date().getFullYear());
  const calMonth = useSignal(new Date().getMonth());
  const selectedDate = useSignal<CalendarDate | null>(null);
  const selectedTime = useSignal('');
  const blockedDates = useSignal<Set<string>>(new Set());
  const blockedTimes = useSignal<string[]>([]);
  const isFetchingTimes = useSignal(false);
  let blockedTimesAbortController: AbortController | null = null;

  useEffect(() => {
    init();
  }, []);

  async function init() {
    if (!reservationId || !bookingEmail) {
      errorMessage.value = 'No booking reference found. Please check your link.';
      view.value = 'error';
      return;
    }
    view.value = 'loading';
    let res: Reservation | null = null;
    try {
	      const tokenParam = bookingToken ? `&token=${encodeURIComponent(bookingToken)}` : '';
      const r = await fetch(`/api/reservations/${encodeURIComponent(reservationId)}?email=${encodeURIComponent(bookingEmail)}${tokenParam}`);
      if (r.status === 404) {
        errorMessage.value = 'Booking not found. It may have already been cancelled or the link is invalid.';
        view.value = 'error';
        return;
      }
      if (!r.ok) {
        errorMessage.value = 'We could not load your booking right now. Please try again later.';
        view.value = 'error';
        return;
      }
      res = await r.json() as Reservation;
    } catch {
      errorMessage.value = 'We could not load your booking right now. Please try again later.';
      view.value = 'error';
      return;
    }
    try {
      const t = await fetch(`/api/tenants/${encodeURIComponent(res.tenant_id)}`);
      if (t.ok) tenantConfig.value = await t.json() as TenantConfig;
    } catch { /* non-fatal */ }
    reservation.value = res;
    view.value = 'overview';
  }

  function goToOverview() {
    errorMessage.value = '';
    view.value = 'overview';
  }

  function goToEditDetails() {
    errorMessage.value = '';
    const r = reservation.value!;
    editData.value = {
      first_name: r.first_name || '',
      surname: r.surname || '',
      telephone: r.telephone || '',
      email: r.email || '',
      dietary_requirements: r.dietary_requirements || '',
      guests: Number(r.guests) || 2,
    };
    view.value = 'edit-details';
  }

  async function goToChangeDatetime(): Promise<void> {
    errorMessage.value = '';
    const r = reservation.value!;
    const [resYear, resMonth, resDay] = r.reservation_date.split('-').map(Number);
    calYear.value = resYear;
    calMonth.value = resMonth - 1;
    selectedDate.value = { year: resYear, month: resMonth - 1, day: resDay };
    selectedTime.value = r.reservation_time || '';
    blockedDates.value = new Set();
    blockedTimes.value = [];
    view.value = 'change-datetime';
    await fetchBlockedDatesForMonth(resYear, resMonth - 1);
    if (selectedDate.value) {
      await fetchBlockedTimesForDate(selectedDate.value);
    }
  }

  function goToCancelConfirm() {
    errorMessage.value = '';
    view.value = 'cancel-confirm';
  }

  async function fetchBlockedDatesForMonth(year: number, month: number): Promise<void> {
    const tenantId = tenantConfig.value?.id;
    if (!tenantId) { blockedDates.value = new Set(); return; }
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    try {
      const r = await fetch(`/api/reservations/blocked-dates?tenant_id=${encodeURIComponent(tenantId)}&month=${monthStr}`);
      if (!r.ok) { blockedDates.value = new Set(); return; }
      const data = await r.json() as { blocked_dates: string[] };
      blockedDates.value = new Set(data.blocked_dates ?? []);
    } catch {
      blockedDates.value = new Set();
    }
  }

  async function fetchBlockedTimesForDate(date: CalendarDate): Promise<void> {
    const tenantId = tenantConfig.value?.id;
    if (!tenantId) { blockedTimes.value = []; return; }
    if (blockedTimesAbortController) {
      blockedTimesAbortController.abort();
    }
    blockedTimesAbortController = new AbortController();
    const { signal } = blockedTimesAbortController;

    isFetchingTimes.value = true;
    try {
      const dateStr = formatDateForAPI(date);
      const guests = Number(reservation.value?.guests) || 2;
      const r = await fetch(`/api/reservations/blocked-times?tenant_id=${encodeURIComponent(tenantId)}&date=${dateStr}&guests=${guests}`, { signal });
      if (!r.ok) { blockedTimes.value = []; return; }
      const data = await r.json() as { blocked_times: string[] };
      blockedTimes.value = data.blocked_times ?? [];
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      blockedTimes.value = [];
    } finally {
      isFetchingTimes.value = false;
    }
  }

  async function selectDate(year: number, month: number, day: number): Promise<void> {
    selectedDate.value = { year, month, day };
    selectedTime.value = '';
    blockedTimes.value = [];
    await fetchBlockedTimesForDate({ year, month, day });
    const currentTime = reservation.value?.reservation_time;
    if (currentTime) {
      const available = getAvailableSlots({ year, month, day }, tenantConfig.value, blockedTimes.value);
      if (available.includes(currentTime)) {
        selectedTime.value = currentTime;
      }
    }
  }

  async function saveEditDetails(data: EditData): Promise<void> {
    errorMessage.value = '';
    const tokenParam = bookingToken ? `&token=${encodeURIComponent(bookingToken)}` : '';
    const emailParam = bookingEmail ? `?email=${encodeURIComponent(bookingEmail)}` : '';
    try {
      const r = await fetch(`/api/reservations/${encodeURIComponent(reservation.value!.id)}${emailParam}${tokenParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        reservation.value = { ...reservation.value!, ...data };
        view.value = 'success-edit';
        return;
      }
      errorMessage.value = r.status === 404
        ? 'Booking not found. It may have already been cancelled.'
        : 'We could not save your changes. Please try again later.';
    } catch {
      errorMessage.value = 'We could not save your changes. Please try again later.';
    }
  }

  async function saveDatetime(): Promise<void> {
    if (!selectedDate.value || !selectedTime.value) return;
    errorMessage.value = '';
    const patchData = {
      reservation_date: formatDateForAPI(selectedDate.value),
      reservation_time: selectedTime.value,
    };
    const tokenParam = bookingToken ? `&token=${encodeURIComponent(bookingToken)}` : '';
    const emailParam = bookingEmail ? `?email=${encodeURIComponent(bookingEmail)}` : '';
    try {
      const r = await fetch(`/api/reservations/${encodeURIComponent(reservation.value!.id)}${emailParam}${tokenParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData),
      });
      if (r.ok) {
        reservation.value = { ...reservation.value!, ...patchData };
        view.value = 'success-edit';
        return;
      }
      errorMessage.value = r.status === 404
        ? 'Booking not found. It may have already been cancelled.'
        : 'We could not save your changes. Please try again later.';
    } catch {
      errorMessage.value = 'We could not save your changes. Please try again later.';
    }
  }

  async function confirmCancel(): Promise<void> {
    errorMessage.value = '';
    const tokenParam = bookingToken ? `&token=${encodeURIComponent(bookingToken)}` : '';
    const emailParam = bookingEmail ? `?email=${encodeURIComponent(bookingEmail)}` : '';
    try {
      const r = await fetch(`/api/reservations/${encodeURIComponent(reservation.value!.id)}${emailParam}${tokenParam}`, {
        method: 'DELETE',
      });
      if (r.ok) {
        view.value = 'success-cancel';
        return;
      }
      errorMessage.value = r.status === 404
        ? 'Booking not found. It may have already been cancelled.'
        : 'We could not cancel your booking right now. Please try again later.';
    } catch {
      errorMessage.value = 'We could not cancel your booking right now. Please try again later.';
    }
  }

  return {
    view, reservation, tenantConfig, errorMessage, editData,
    calYear, calMonth, selectedDate, selectedTime,
    blockedDates, blockedTimes, isFetchingTimes,
    goToOverview, goToEditDetails, goToChangeDatetime, goToCancelConfirm,
    saveEditDetails, saveDatetime, confirmCancel,
    fetchBlockedDatesForMonth, fetchBlockedTimesForDate, selectDate,
  };
}
