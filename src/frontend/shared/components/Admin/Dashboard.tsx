import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import type { UseAuthReturn } from '@shared/hooks/useAuth';
import { useBookings } from '@shared/hooks/useBookings';
import { ToggleSwitch } from '@shared/components';
import DateNav from './DateNav';
import ReservationList from './ReservationList';
import BookingCards from './BookingCards';
import BookingModal from './BookingModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import styles from './Dashboard.module.css';

interface DashboardProps {
  auth: UseAuthReturn;
  onLogout: () => void;
  onGoSettings: () => void;
}

const Dashboard: FunctionComponent<DashboardProps> = ({ auth, onLogout, onGoSettings }) => {
  const bookings = useBookings(() => auth.token.value);
  const modalOpen = useSignal(false);
  const modalMode = useSignal<'create' | 'edit'>('create');
  const modalReservation = useSignal<Reservation | undefined>(undefined);
  const deleteModalOpen = useSignal(false);
  const deleteReservation = useSignal<Reservation | undefined>(undefined);

  const venueName = auth.tenantConfig.value?.name ?? 'Dashboard';

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

  const reservations = bookings.reservations.value;

  return (
    <div class={styles.dashboard_layout}>
      <AdminSidebar activePage="bookings" onGoBookings={() => {}} onGoSettings={onGoSettings} />

      <div class={styles.main_panel}>
        <AdminHeader venueName={venueName} onLogout={onLogout} />

        <main id="main-content" class={styles.main_content}>
          <DateNav
            currentDate={bookings.currentDate}
            guestCount={bookings.guestCount.value}
            onPrev={bookings.prevDay}
            onNext={bookings.nextDay}
          />

          <div class={styles.day_actions_row}>
            <div class={styles.toggle_list} id="day-block-container">
              <div class={styles.toggle_list_item}>
                <div class={styles.toggle_list_item_content}>
                  <p class={styles.toggle_list_item_header}><strong>Block this day</strong></p>
                  <p class={styles.toggle_list_item_subtext}>
                    Customers will no longer be able to make reservations on this date. Existing reservations will not be affected.
                  </p>
                </div>
                <div class={styles.toggle_list_item_switch}>
                  <div class={styles.form_group_check}>
                    <ToggleSwitch
                      checked={bookings.isDayBlocked.value}
                      disabled={bookings.isBlockLoading.value}
                      onChange={() => bookings.toggleDayBlock()}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class={styles.new_booking_card}>
              <div class={styles.toggle_list_item_content}>
                <p class={styles.toggle_list_item_header}><strong>New booking</strong></p>
                <p class={styles.toggle_list_item_subtext}>
                  Manually add a reservation for this date.
                </p>
              </div>
              <button class={styles.btn_primary} onClick={openCreate}>
                + New Booking
              </button>
            </div>
          </div>

          <div id="bookings-list" aria-busy={bookings.isLoading.value}>
            {bookings.isLoading.value && (
              <p class={styles.loading_text}>Loading…</p>
            )}
            {!bookings.isLoading.value && bookings.errorMessage.value && (
              <p class={styles.error_text}>{bookings.errorMessage.value}</p>
            )}
            {!bookings.isLoading.value && !bookings.errorMessage.value && reservations.length === 0 && (
              <p class={styles.empty_state}>No bookings for this date.</p>
            )}
            {!bookings.isLoading.value && reservations.length > 0 && (
              <>
                <ReservationList
                  reservations={reservations}
                  onEdit={openEdit}
                  onDelete={handleDeleteClick}
                />
                <BookingCards
                  reservations={reservations}
                  onEdit={openEdit}
                  onDelete={handleDeleteClick}
                />
              </>
            )}
          </div>
        </main>
      </div>

      {modalOpen.value && auth.token.value && (
        <BookingModal
          mode={modalMode.value}
          reservation={modalReservation.value}
          token={auth.token.value}
          onSuccess={() => bookings.fetchBookings(bookings.currentDate.value)}
          onClose={() => { modalOpen.value = false; }}
        />
      )}

      {deleteModalOpen.value && deleteReservation.value && auth.token.value && (
        <DeleteConfirmModal
          reservation={deleteReservation.value}
          token={auth.token.value}
          onSuccess={() => bookings.fetchBookings(bookings.currentDate.value)}
          onClose={() => { deleteModalOpen.value = false; }}
        />
      )}
    </div>
  );
};

export default Dashboard;
