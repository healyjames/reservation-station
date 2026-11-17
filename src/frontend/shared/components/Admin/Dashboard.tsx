import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import type { UseAuthReturn } from '@shared/hooks/useAuth';
import { useEffect } from 'preact/hooks';
import { useBookings } from '@shared/hooks/useBookings';
import { useDateOverrides } from '@shared/hooks/useDateOverrides';
import { Alert, Button, Card, Loading, Toggle } from '@shared/components/ui';
import { Plus, RefreshCw } from '@shared/components/ui/icons';
import DateNav from './DateNav';
import ReservationList from './ReservationList';
import BookingCards from './BookingCards';
import BookingModal from './BookingModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import CalendarPickerModal from './CalendarPickerModal';
import DayHoursBanner from './DayHoursBanner';

type DashboardProps = {
  auth: UseAuthReturn;
};

/** The Bookings page: one day's reservations, with day blocking and new bookings. AdminLayout supplies the shell. */
const Dashboard: FunctionComponent<DashboardProps> = ({ auth }) => {
  const bookings = useBookings(() => auth.token.value);
  const dateOverrides = useDateOverrides(() => auth.token.value);
  const modalOpen = useSignal(false);
  const modalMode = useSignal<'create' | 'edit'>('create');
  const modalReservation = useSignal<Reservation | undefined>(undefined);
  const deleteModalOpen = useSignal(false);
  const deleteReservation = useSignal<Reservation | undefined>(undefined);
  const calendarPickerOpen = useSignal(false);

  function openEdit(reservation: Reservation) {
    modalReservation.value = reservation;
    modalMode.value = 'edit';
    modalOpen.value = true;
  }

  function openCreate() {
    modalReservation.value = undefined;
    modalMode.value = 'create';
    modalOpen.value = true;
  }

  function handleDeleteClick(reservation: Reservation) {
    deleteReservation.value = reservation;
    deleteModalOpen.value = true;
  }

  function formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const reservations = bookings.reservations.value;
  const visibleDateKey = formatDate(bookings.currentDate.value);
  const visibleMonthKey = visibleDateKey.slice(0, 7);

  useEffect(() => {
    void dateOverrides.loadMonth(visibleMonthKey);
  }, [visibleMonthKey]);

  return (
    <>
      <DateNav
        currentDate={bookings.currentDate}
        guestCount={bookings.guestCount.value}
        onPrev={bookings.prevDay}
        onNext={bookings.nextDay}
        onOpenCalendar={() => {
          calendarPickerOpen.value = true;
        }}
      />

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
        <Card id="day-block-container" class="bg-base-200 [--card-p:1rem_1.25rem]">
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div>
              <p class="m-0 font-semibold">Block this day</p>
              <p id="block-day-description" class="text-base-content/70 m-0 text-xs">
                Customers will no longer be able to make reservations on this date. Existing reservations will not be affected.
              </p>
            </div>
            <Toggle
              aria-describedby="block-day-description"
              label="Block this day"
              hideLabel
              checked={bookings.isDayBlocked.value}
              disabled={bookings.isBlockLoading.value}
              onChange={() => bookings.toggleDayBlock()}
            />
          </div>
        </Card>

        <Card class="bg-base-200 [--card-p:1rem_1.25rem]">
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div>
              <p class="m-0 font-semibold">New booking</p>
              <p class="text-base-content/70 m-0 text-xs">Manually add a reservation for this date.</p>
            </div>
            <Button variant="primary" onClick={openCreate}>
              <Plus />
              New Booking
            </Button>
          </div>
        </Card>

        <Button
          class="md:col-span-2 xl:col-span-1 xl:h-auto"
          disabled={bookings.isLoading.value || bookings.isBlockLoading.value}
          onClick={() => {
            void bookings.refreshMonth();
            void dateOverrides.loadMonth(visibleMonthKey, true);
          }}
        >
          <RefreshCw />
          Refresh
        </Button>
      </div>

      {bookings.blockErrorMessage.value && (
        <Alert variant="error" live="assertive">
          {bookings.blockErrorMessage.value}
        </Alert>
      )}

      <DayHoursBanner blocks={bookings.dayBlocks.value} specialHours={dateOverrides.overridesByDate.value.get(visibleDateKey) ?? null} />

      <div id="bookings-list" class="min-w-0" aria-busy={bookings.isLoading.value}>
        {bookings.isLoading.value && (
          <p class="text-base-content/70 flex items-center justify-center gap-3 py-8">
            <Loading size="sm" label={null} />
            Loading…
          </p>
        )}
        {!bookings.isLoading.value && bookings.errorMessage.value && <Alert variant="error">{bookings.errorMessage.value}</Alert>}
        {!bookings.isLoading.value && !bookings.errorMessage.value && reservations.length === 0 && (
          <p class="text-base-content/70 py-8 text-center italic">No bookings for this date.</p>
        )}
        {!bookings.isLoading.value && reservations.length > 0 && (
          <>
            <ReservationList reservations={reservations} onEdit={openEdit} onDelete={handleDeleteClick} />
            <BookingCards reservations={reservations} onEdit={openEdit} onDelete={handleDeleteClick} />
          </>
        )}
      </div>

      {modalOpen.value && auth.token.value && (
        <BookingModal
          mode={modalMode.value}
          reservation={modalReservation.value}
          defaultDate={modalMode.value === 'create' ? formatDate(bookings.currentDate.value) : undefined}
          token={auth.token.value}
          onSuccess={() => bookings.fetchBookings(bookings.currentDate.value)}
          onClose={() => {
            modalOpen.value = false;
          }}
        />
      )}

      {deleteModalOpen.value && deleteReservation.value && auth.token.value && (
        <DeleteConfirmModal
          reservation={deleteReservation.value}
          token={auth.token.value}
          onSuccess={() => bookings.fetchBookings(bookings.currentDate.value)}
          onClose={() => {
            deleteModalOpen.value = false;
          }}
        />
      )}
      {calendarPickerOpen.value && auth.tenantConfig.value && (
        <CalendarPickerModal
          open={calendarPickerOpen.value}
          onClose={() => {
            calendarPickerOpen.value = false;
          }}
          currentDate={bookings.currentDate.value}
          tenantId={auth.tenantConfig.value.id}
          onDateSelect={(date) => {
            void bookings.fetchBookings(date);
          }}
        />
      )}
    </>
  );
};

export default Dashboard;
