import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { Reservation } from '@shared/types';
import { StandaloneLayout, BookingDetailsList } from '@shared/components';
import { Button } from '@shared/components/ui';
import { formatDate, getFullName, getGuestsLabel } from '@shared/utils';
import { ErrorAlert } from './ErrorAlert';

type CancelConfirmProps = {
  reservation: Signal<Reservation | null>;
  errorMessage: Signal<string>;
  goToOverview: () => void;
  confirmCancel: () => Promise<void>;
};

export const CancelConfirm: FunctionComponent<CancelConfirmProps> = ({ reservation, errorMessage, goToOverview, confirmCancel }) => {
  const isCancelling = useSignal(false);
  const r = reservation.value!;
  const details = [
    { label: 'Name', value: getFullName(r) },
    { label: 'Date', value: formatDate(r.reservation_date) },
    { label: 'Time', value: r.reservation_time || 'Unknown time' },
    { label: 'Party size', value: getGuestsLabel(Number(r.guests)) },
    ...(r.dietary_requirements?.trim() ? [{ label: 'Dietary requirements & special requests', value: r.dietary_requirements.trim() }] : []),
  ];

  async function handleCancel() {
    isCancelling.value = true;
    await confirmCancel();
    isCancelling.value = false;
  }

  return (
    <StandaloneLayout title="Cancel Booking">
      <p>Are you sure you want to cancel this reservation?</p>
      <ErrorAlert message={errorMessage.value} />
      <BookingDetailsList details={details} />
      <div class="grid gap-3 sm:grid-cols-2">
        <Button variant="ghost" onClick={goToOverview}>
          Keep My Booking
        </Button>
        <Button variant="error" isLoading={isCancelling.value} onClick={handleCancel}>
          {isCancelling.value ? 'Cancelling...' : 'Cancel My Booking'}
        </Button>
      </div>
    </StandaloneLayout>
  );
};
