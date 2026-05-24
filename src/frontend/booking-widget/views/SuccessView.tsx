import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { MessageCard, Button } from '@shared/components';
import { formatDateForDisplay } from '@shared/utils';
import type { BookingFormData } from '../types/booking';

interface SuccessViewProps {
  formData: BookingFormData;
  selectedDate: CalendarDate;
  onNewBooking: () => void;
}

export const SuccessView: FunctionComponent<SuccessViewProps> = ({ formData, selectedDate, onNewBooking }) => {
  const dateDisplay = formatDateForDisplay(selectedDate);
  const guestLabel = `${formData.guests} guest${formData.guests > 1 ? 's' : ''}`;

  return (
    <div class="booking-form-content">
      <MessageCard variant="success" title="Booking Confirmed!">
        <p>
          Your reservation for <strong>{guestLabel}</strong> on{' '}
          <strong>{dateDisplay}</strong> at{' '}
          <strong>{formData.time}</strong> has been confirmed.
        </p>
        <p>We've sent a confirmation email to <strong>{formData.email}</strong>.</p>
      </MessageCard>
      <Button variant="secondary" onClick={onNewBooking}>
        Make Another Booking
      </Button>
    </div>
  );
};
