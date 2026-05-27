import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { Reservation } from '@shared/types';
import { StandaloneLayout, BookingDetailsList, Button, MessageCard } from '@shared/components';
import { formatDate, getFullName, getGuestsLabel } from '@shared/utils';

interface OverviewProps {
  reservation: Signal<Reservation | null>;
  errorMessage: Signal<string>;
  goToEditDetails: () => void;
  goToChangeDatetime: () => Promise<void>;
  goToCancelConfirm: () => void;
}

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
    ...(r.dietary_requirements?.trim()
      ? [{ label: 'Dietary requirements', value: r.dietary_requirements.trim() }]
      : []),
  ];

  return (
    <StandaloneLayout title="Manage your booking">
      <p class="page-subtitle">View, edit, or cancel your reservation.</p>
      {errorMessage.value && (
        <MessageCard variant="error" title="Something went wrong">
          <p>{errorMessage.value}</p>
        </MessageCard>
      )}
      <BookingDetailsList details={details} />
      <div class="action-group">
        <Button variant="secondary" onClick={goToEditDetails}>Edit Details</Button>
        <Button variant="secondary" onClick={() => goToChangeDatetime()}>Change Date &amp; Time</Button>
      </div>
      <Button variant="danger" fullWidth onClick={goToCancelConfirm}>Cancel Booking</Button>
    </StandaloneLayout>
  );
};
