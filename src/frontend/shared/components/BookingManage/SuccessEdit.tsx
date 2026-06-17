import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { StandaloneLayout, MessageCard, Button } from '@shared/components';
import { formatDate, getFullName, getGuestsLabel } from '@shared/utils';
import styles from './SuccessEdit.module.css';

interface SuccessEditProps {
  reservation: Reservation;
  onBack: () => void;
}

export const SuccessEdit: FunctionComponent<SuccessEditProps> = ({ reservation, onBack }) => (
  <StandaloneLayout title="Manage your booking">
    <div class={styles.content}>
      <MessageCard variant="success" title="Booking updated.">
        <p>
          <strong>{getFullName(reservation)}</strong> &mdash;{' '}
          {formatDate(reservation.reservation_date)} at{' '}
          <strong>{reservation.reservation_time || 'Unknown time'}</strong> &mdash;{' '}
          {getGuestsLabel(Number(reservation.guests))}
        </p>
      </MessageCard>
      <Button variant="primary" onClick={onBack}>Back to booking details</Button>
    </div>
  </StandaloneLayout>
);
