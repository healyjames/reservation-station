import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { StandaloneLayout } from '@shared/components';
import { Alert } from '@shared/components/ui';
import { formatDate, getFullName } from '@shared/utils';

type SuccessCancelProps = {
  reservation: Reservation;
};

export const SuccessCancel: FunctionComponent<SuccessCancelProps> = ({ reservation }) => (
  <StandaloneLayout title="Manage your booking">
    <div class="p-6 motion-safe:animate-slide-in">
      <Alert variant="success" title="Your booking has been cancelled." headingLevel={2}>
        <p>
          <strong>{getFullName(reservation)}</strong> on <strong>{formatDate(reservation.reservation_date)}</strong> at{' '}
          <strong>{reservation.reservation_time || 'Unknown time'}</strong> has been cancelled.
        </p>
      </Alert>
    </div>
  </StandaloneLayout>
);
