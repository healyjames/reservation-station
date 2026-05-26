import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { StandaloneLayout, MessageCard } from '@shared/components';
import { formatDate, getFullName } from '@shared/utils';

interface SuccessCancelViewProps {
  reservation: Reservation;
}

export const SuccessCancelView: FunctionComponent<SuccessCancelViewProps> = ({ reservation }) => (
  <StandaloneLayout title="Manage your booking">
    <MessageCard variant="success" title="Your booking has been cancelled.">
      <p>
        <strong>{getFullName(reservation)}</strong> on{' '}
        <strong>{formatDate(reservation.reservation_date)}</strong> at{' '}
        <strong>{reservation.reservation_time || 'Unknown time'}</strong>{' '}
        has been cancelled.
      </p>
    </MessageCard>
  </StandaloneLayout>
);
