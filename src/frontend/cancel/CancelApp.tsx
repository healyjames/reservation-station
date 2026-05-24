import type { FunctionComponent } from 'preact';
import { LoadingView } from './views/LoadingView';
import { ErrorView } from './views/ErrorView';
import { OverviewView } from './views/OverviewView';
import { SuccessView } from './views/SuccessView';
import { useCancelBooking } from './hooks/useCancelBooking';

interface CancelAppProps {
  reservationId: string | null;
}

export const CancelApp: FunctionComponent<CancelAppProps> = ({ reservationId }) => {
  const { view, reservation, errorMessage, inlineError, isCancelling, handleCancel } = useCancelBooking(reservationId);

  if (view.value === 'loading') return <LoadingView />;
  if (view.value === 'error') return <ErrorView message={errorMessage.value} />;
  if (view.value === 'success') return <SuccessView reservation={reservation.value!} />;
  return (
    <OverviewView
      reservation={reservation.value!}
      inlineError={inlineError.value}
      isCancelling={isCancelling.value}
      onCancel={handleCancel}
    />
  );
};
