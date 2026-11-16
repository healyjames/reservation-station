import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { StandaloneLayout } from '@shared/components';
import { Alert } from '@shared/components/ui';
import { formatDate, getFullName } from '@shared/utils';

type SuccessProps = {
  reservation: Reservation;
};

export const Success: FunctionComponent<SuccessProps> = ({ reservation }) => (
  <StandaloneLayout title="Cancel your booking">
    <Alert variant="success" title="Your booking has been cancelled." headingLevel={2}>
      <p>
        <strong>{getFullName(reservation)}</strong> on <strong>{formatDate(reservation.reservation_date)}</strong> at{' '}
        <strong>{reservation.reservation_time || 'Unknown time'}</strong> has been cancelled.
      </p>
    </Alert>
  </StandaloneLayout>
);
