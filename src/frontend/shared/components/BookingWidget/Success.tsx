import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { MessageCard, Button } from '@shared/components';
import { formatDateForDisplay } from '@shared/utils';
import type { BookingFormData } from '@shared/types';
import styles from './Success.module.css';

interface SuccessProps {
  formData: BookingFormData;
  selectedDate: CalendarDate;
  onNewBooking: () => void;
  bookingRef?: string;
}

export const Success: FunctionComponent<SuccessProps> = ({ formData, selectedDate, onNewBooking, bookingRef }) => {
  const dateDisplay = formatDateForDisplay(selectedDate);
  const guestLabel = `${formData.guests} guest${formData.guests > 1 ? 's' : ''}`;

  return (
    <div class={styles.content}>
      <MessageCard variant="success" title="Booking Confirmed!">
        <p>
          Your reservation for <strong>{guestLabel}</strong> on{' '}
          <strong>{dateDisplay}</strong> at{' '}
          <strong>{formData.time}</strong> has been confirmed.
        </p>
        <p>We've sent a confirmation email to <strong>{formData.email}</strong>.</p>
        <p>
          To manage or cancel your booking, use the link in your confirmation email.
        </p>
      </MessageCard>
      <Button variant="secondary" class={styles.success_button} fullWidth onClick={onNewBooking}>
        Book Another Table
      </Button>
    </div>
  );
};
