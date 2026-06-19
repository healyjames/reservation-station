import type { FunctionComponent } from 'preact';
import { Loading, Error, Overview, Success } from '@shared/components/Cancel';
import { useCancelBooking } from '@shared/hooks/useCancelBooking';

interface CancelAppProps {
  reservationId: string | null;
  bookingEmail: string | null;
  bookingToken: string | null;
}

export const CancelApp: FunctionComponent<CancelAppProps> = ({ reservationId, bookingEmail, bookingToken }) => {
  const { view, reservation, errorMessage, inlineError, isCancelling, handleCancel } = useCancelBooking(
    reservationId,
    bookingEmail,
    bookingToken,
  );

  if (view.value === 'loading') return <Loading />;
  if (view.value === 'error') return <Error message={errorMessage.value} />;
  if (view.value === 'success') return <Success reservation={reservation.value!} />;
  return (
    <Overview reservation={reservation.value!} inlineError={inlineError.value} isCancelling={isCancelling.value} onCancel={handleCancel} />
  );
};
