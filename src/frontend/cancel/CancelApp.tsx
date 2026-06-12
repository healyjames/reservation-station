import type { FunctionComponent } from 'preact';
import { Loading } from '@shared/components/Cancel/Loading';
import { Error } from '@shared/components/Cancel/Error';
import { Overview } from '@shared/components/Cancel/Overview';
import { Success } from '@shared/components/Cancel/Success';
import { useCancelBooking } from '@shared/hooks/useCancelBooking';

interface CancelAppProps {
  reservationId: string | null;
  bookingEmail: string | null;
}

export const CancelApp: FunctionComponent<CancelAppProps> = ({ reservationId, bookingEmail }) => {
  const { view, reservation, errorMessage, inlineError, isCancelling, handleCancel } = useCancelBooking(reservationId, bookingEmail);

  if (view.value === 'loading') return <Loading />;
  if (view.value === 'error') return <Error message={errorMessage.value} />;
  if (view.value === 'success') return <Success reservation={reservation.value!} />;
  return (
    <Overview
      reservation={reservation.value!}
      inlineError={inlineError.value}
      isCancelling={isCancelling.value}
      onCancel={handleCancel}
    />
  );
};
