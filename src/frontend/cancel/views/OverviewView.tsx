import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { StandaloneLayout, BookingDetailsList, Button, MessageCard } from '@shared/components';
import { formatDate, getFullName, getGuestsLabel } from '@shared/utils';

interface OverviewViewProps {
  reservation: Reservation;
  inlineError: string;
  isCancelling: boolean;
  onCancel: () => void;
}

export const OverviewView: FunctionComponent<OverviewViewProps> = ({
  reservation,
  inlineError,
  isCancelling,
  onCancel,
}) => {
  const details = [
    { label: 'Name', value: getFullName(reservation) },
    { label: 'Date', value: formatDate(reservation.reservation_date) },
    { label: 'Time', value: reservation.reservation_time || 'Unknown time' },
    { label: 'Party size', value: getGuestsLabel(Number(reservation.guests) || 0) },
    ...(reservation.dietary_requirements?.trim()
      ? [{ label: 'Dietary requirements', value: reservation.dietary_requirements.trim() }]
      : []),
  ];

  return (
    <StandaloneLayout title="Cancel your booking">
      <p>Please review the booking below. If this is the one you want to cancel, use the button at the bottom of the page.</p>

      {inlineError && (
        <MessageCard variant="error" title="Something went wrong">
          <p>{inlineError}</p>
        </MessageCard>
      )}

      <BookingDetailsList details={details} />

      <Button
        variant="danger"
        fullWidth
        isLoading={isCancelling}
        onClick={onCancel}
      >
        {isCancelling ? 'Cancelling...' : 'Cancel My Booking'}
      </Button>
    </StandaloneLayout>
  );
};
