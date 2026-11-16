import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { StandaloneLayout } from '@shared/components';
import { Alert, Button } from '@shared/components/ui';
import { formatDate, getFullName, getGuestsLabel } from '@shared/utils';

type SuccessEditProps = {
  reservation: Reservation;
  onBack: () => void;
};

export const SuccessEdit: FunctionComponent<SuccessEditProps> = ({ reservation, onBack }) => (
  <StandaloneLayout title="Manage your booking">
    <div class="flex flex-col gap-6 p-4 motion-safe:animate-slide-in">
      <Alert variant="success" title="Booking updated." headingLevel={2}>
        <p>
          <strong>{getFullName(reservation)}</strong> &mdash; {formatDate(reservation.reservation_date)} at{' '}
          <strong>{reservation.reservation_time || 'Unknown time'}</strong> &mdash; {getGuestsLabel(Number(reservation.guests))}
        </p>
      </Alert>
      <Button variant="primary" onClick={onBack}>
        Back to booking details
      </Button>
    </div>
  </StandaloneLayout>
);
