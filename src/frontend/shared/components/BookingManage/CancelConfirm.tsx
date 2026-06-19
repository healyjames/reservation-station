import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { Reservation } from '@shared/types';
import { StandaloneLayout, BookingDetailsList, Button, MessageCard } from '@shared/components';
import { formatDate, getFullName, getGuestsLabel } from '@shared/utils';
import styles from './CancelConfirm.module.css';

interface CancelConfirmProps {
  reservation: Signal<Reservation | null>;
  errorMessage: Signal<string>;
  goToOverview: () => void;
  confirmCancel: () => Promise<void>;
}

export const CancelConfirm: FunctionComponent<CancelConfirmProps> = ({ reservation, errorMessage, goToOverview, confirmCancel }) => {
  const isCancelling = useSignal(false);
  const r = reservation.value!;
  const details = [
    { label: 'Name', value: getFullName(r) },
    { label: 'Date', value: formatDate(r.reservation_date) },
    { label: 'Time', value: r.reservation_time || 'Unknown time' },
    { label: 'Party size', value: getGuestsLabel(Number(r.guests)) },
    ...(r.dietary_requirements?.trim() ? [{ label: 'Dietary requirements', value: r.dietary_requirements.trim() }] : []),
  ];

  async function handleCancel() {
    isCancelling.value = true;
    await confirmCancel();
    isCancelling.value = false;
  }

  return (
    <StandaloneLayout title="Cancel Booking">
      <p>Are you sure you want to cancel this reservation?</p>
      {errorMessage.value && (
        <MessageCard variant="error" title="Something went wrong">
          <p>{errorMessage.value}</p>
        </MessageCard>
      )}
      <BookingDetailsList details={details} />
      <div class={styles.action_group}>
        <Button variant="ghost" onClick={goToOverview}>
          Keep My Booking
        </Button>
        <Button variant="danger" isLoading={isCancelling.value} onClick={handleCancel}>
          {isCancelling.value ? 'Cancelling...' : 'Cancel My Booking'}
        </Button>
      </div>
    </StandaloneLayout>
  );
};
