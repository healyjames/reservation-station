import type { FunctionComponent } from 'preact';
import type { BookingFormData, CalendarDate } from '@shared/types';
import { Alert, Button } from '@shared/components/ui';
import { formatDateForDisplay } from '@shared/utils';

type SuccessProps = {
  formData: BookingFormData;
  selectedDate: CalendarDate;
  onNewBooking: () => void;
  bookingRef?: string;
};

export const Success: FunctionComponent<SuccessProps> = ({ formData, selectedDate, onNewBooking }) => {
  const dateDisplay = formatDateForDisplay(selectedDate);
  const guestLabel = `${formData.guests} guest${formData.guests > 1 ? 's' : ''}`;

  return (
    <div class="p-6 motion-safe:animate-slide-in">
      <Alert variant="success" title="Booking Confirmed!" headingLevel={2}>
        <p>
          Your reservation for <strong>{guestLabel}</strong> on <strong>{dateDisplay}</strong> at <strong>{formData.time}</strong> has been
          confirmed.
        </p>
        <p>
          We've sent a confirmation email to <strong>{formData.email}</strong>.
        </p>
        <p>To manage or cancel your booking, use the link in your confirmation email.</p>
      </Alert>
      <Button block class="mt-6" onClick={onNewBooking}>
        Book Another Table
      </Button>
    </div>
  );
};
