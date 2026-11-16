import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { Reservation } from '@shared/types';
import { StandaloneLayout, BookingDetailsList } from '@shared/components';
import { Button } from '@shared/components/ui';
import { formatDate, getFullName, getGuestsLabel } from '@shared/utils';
import { ErrorAlert } from './ErrorAlert';

type OverviewProps = {
  reservation: Signal<Reservation | null>;
  errorMessage: Signal<string>;
  goToEditDetails: () => void;
  goToChangeDatetime: () => Promise<void>;
  goToCancelConfirm: () => void;
};

export const Overview: FunctionComponent<OverviewProps> = ({
  reservation,
  errorMessage,
  goToEditDetails,
  goToChangeDatetime,
  goToCancelConfirm,
}) => {
  const r = reservation.value!;
  const details = [
    { label: 'Name', value: getFullName(r) },
    { label: 'Date', value: formatDate(r.reservation_date) },
    { label: 'Time', value: r.reservation_time || 'Unknown time' },
    { label: 'Party size', value: getGuestsLabel(Number(r.guests)) },
    ...(r.dietary_requirements?.trim() ? [{ label: 'Dietary requirements & special requests', value: r.dietary_requirements.trim() }] : []),
  ];

  return (
    <StandaloneLayout title="Manage your booking">
      <p>View, edit, or cancel your reservation.</p>
      <ErrorAlert message={errorMessage.value} />
      <BookingDetailsList details={details} />
      <div class="grid gap-3 sm:grid-cols-2">
        <Button variant="primary" onClick={goToEditDetails}>
          Edit Details
        </Button>
        <Button onClick={() => goToChangeDatetime()}>Change Date &amp; Time</Button>
      </div>
      <Button variant="error" block onClick={goToCancelConfirm}>
        Cancel Booking
      </Button>
    </StandaloneLayout>
  );
};
