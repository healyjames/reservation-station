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
    modalReservation.value = reservation;
    modalMode.value = 'edit';
    modalOpen.value = true;
  }

  const reservations = bookings.reservations.value;

  return (
    <div class="dashboard-layout">
      <nav class="sidebar-nav" aria-label="Admin navigation">
        <div class="sidebar-logo" aria-hidden="true" />
        <button class="tab-btn active" aria-current="page">
          Bookings
        </button>
        <button class="tab-btn" onClick={onGoSettings}>
          Settings
        </button>
      </nav>

      <div class="main-panel">
        <header class="main-header">
          <span id="venue-name" class="header-brand">{venueName}</span>
          <button class="btn-logout" onClick={onLogout}>Sign out</button>
        </header>

        <main id="main-content" class="main-content">
          <DateNav
            currentDate={bookings.currentDate}
            guestCount={bookings.guestCount.value}
            onPrev={bookings.prevDay}
            onNext={bookings.nextDay}
          />

          <div class="toggle-list" id="day-block-container">
            <div class="toggle-list-item">
              <div class="toggle-list-item-content">
                <p class="toggle-list-item-header"><strong>Block this day</strong></p>
                <p class="toggle-list-item-subtext">
                  Customers will no longer be able to make reservations on this date. Existing reservations will not be affected.
                </p>
              </div>
              <div class="toggle-list-item-switch">
                <div class="form-group-check">
                  <ToggleSwitch
                    checked={bookings.isDayBlocked.value}
                    disabled={bookings.isBlockLoading.value}
                    onChange={() => bookings.toggleDayBlock()}
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="bookings-actions">
            <button class="btn-primary" onClick={openCreate}>
              + New Booking
            </button>
          </div>

          <div id="bookings-list" aria-busy={bookings.isLoading.value}>
            {bookings.isLoading.value && (
              <p class="loading-text">Loading…</p>
            )}
            {!bookings.isLoading.value && bookings.errorMessage.value && (
              <p class="error-text">{bookings.errorMessage.value}</p>
            )}
            {!bookings.isLoading.value && !bookings.errorMessage.value && reservations.length === 0 && (
              <p class="empty-state">No bookings for this date.</p>
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
    </div>
  );
};

export default Dashboard;
