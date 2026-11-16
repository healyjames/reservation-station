import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { StandaloneLayout, BookingDetailsList } from '@shared/components';
import { Alert, Button } from '@shared/components/ui';
import { formatDate, getFullName, getGuestsLabel } from '@shared/utils';

type OverviewProps = {
  reservation: Reservation;
  inlineError: string;
  isCancelling: boolean;
  onCancel: () => void;
};

export const Overview: FunctionComponent<OverviewProps> = ({ reservation, inlineError, isCancelling, onCancel }) => {
  const details = [
    { label: 'Name', value: getFullName(reservation) },
    { label: 'Date', value: formatDate(reservation.reservation_date) },
    { label: 'Time', value: reservation.reservation_time || 'Unknown time' },
    { label: 'Party size', value: getGuestsLabel(Number(reservation.guests) || 0) },
    ...(reservation.dietary_requirements?.trim()
      ? [{ label: 'Dietary requirements & special requests', value: reservation.dietary_requirements.trim() }]
      : []),
  ];

  return (
    <StandaloneLayout title="Cancel your booking">
      <p>Please review the booking below. If this is the one you want to cancel, use the button at the bottom of the page.</p>

      {inlineError && (
        <Alert variant="error" title="Something went wrong" headingLevel={null} live="assertive">
          <p>{inlineError}</p>
        </Alert>
      )}

      <BookingDetailsList details={details} />

      <Button variant="error" block isLoading={isCancelling} onClick={onCancel}>
        {isCancelling ? 'Cancelling...' : 'Cancel My Booking'}
      </Button>
    </StandaloneLayout>
  );
};
