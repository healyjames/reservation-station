import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { Calendar } from '@shared/components/BookingWidget/Calendar';
import Modal from '@shared/components/Modal/Modal';

interface CalendarPickerModalProps {
  open: boolean;
  onClose: () => void;
  currentDate: Date;
  tenantId: string;
  onDateSelect: (date: Date) => void;
}

const CalendarPickerModal: FunctionComponent<CalendarPickerModalProps> = ({
  open,
  onClose,
  currentDate,
  tenantId,
  onDateSelect,
}) => {
  const calYear = useSignal(currentDate.getFullYear());
  const calMonth = useSignal(currentDate.getMonth());
  const selectedDate = useSignal<CalendarDate | null>({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
    day: currentDate.getDate(),
  });
  const blockedDates = useSignal<Set<string>>(new Set());
  const blockedDatesError = useSignal('');
  const isFetchingDates = useSignal(false);

  useEffect(() => {
    if (open) {
      calYear.value = currentDate.getFullYear();
      calMonth.value = currentDate.getMonth();
      selectedDate.value = {
        year: currentDate.getFullYear(),
        month: currentDate.getMonth(),
        day: currentDate.getDate(),
      };
    }
  }, [open]);

  async function fetchBlockedDates(year: number, month: number): Promise<void> {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    blockedDatesError.value = '';
    isFetchingDates.value = true;
    try {
      const res = await fetch(`/api/reservations/blocked-dates?tenant_id=${encodeURIComponent(tenantId)}&month=${monthStr}`);
      if (!res.ok) {
        blockedDatesError.value = 'Could not load availability.';
        return;
      }
      const data = (await res.json()) as { blocked_dates?: string[] };
      blockedDates.value = new Set(data.blocked_dates ?? []);
    } catch {
      blockedDatesError.value = 'Could not load availability.';
    } finally {
      isFetchingDates.value = false;
    }
  }

  async function handleMonthChange(year: number, month: number): Promise<void> {
    calYear.value = year;
    calMonth.value = month;
    await fetchBlockedDates(year, month);
  }

  async function handleDateSelect(year: number, month: number, day: number): Promise<void> {
    selectedDate.value = { year, month, day };
    onDateSelect(new Date(year, month, day));
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Go to date">
      <Calendar
        year={calYear.value}
        month={calMonth.value}
        selectedDate={selectedDate.value}
        blockedDates={blockedDates.value}
        blockedDatesError={blockedDatesError.value}
        isFetchingDates={isFetchingDates.value}
        onMonthChange={handleMonthChange}
        onDateSelect={handleDateSelect}
        allowPastDates
      />
    </Modal>
  );
};

export default CalendarPickerModal;
