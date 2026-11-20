import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Alert, Button, Fieldset, Input, Modal, Textarea } from '@shared/components/ui';
import { adminFetch } from '@shared/utils/adminFetch';

type BookingModalProps = {
  mode: 'create' | 'edit';
  reservation?: Reservation;
  defaultDate?: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
};

const BookingModal: FunctionComponent<BookingModalProps> = ({ mode, reservation, defaultDate, token, onSuccess, onClose }) => {
  const firstName = useSignal(reservation?.first_name ?? '');
  const surname = useSignal(reservation?.surname ?? '');
  const telephone = useSignal(reservation?.telephone ?? '');
  const email = useSignal(reservation?.email ?? '');
  const reservationDate = useSignal(reservation?.reservation_date ?? defaultDate ?? '');
  const reservationTime = useSignal(reservation?.reservation_time ?? '');
  // Kept as typed so the field can be cleared while editing; clampGuests turns it into a party size.
  const guests = useSignal(String(reservation?.guests ?? 2));
  const dietary = useSignal(reservation?.dietary_requirements ?? '');
  const errorMessage = useSignal('');
  const isSubmitting = useSignal(false);

  const title = mode === 'edit' ? 'Edit Booking' : 'New Booking';

  /** A whole number of at least 1; an empty or invalid entry counts as 1. Number() also reads `1e1` as 10. */
  const clampGuests = (value: string) => Math.max(1, Math.trunc(Number(value)) || 1);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    errorMessage.value = '';
    isSubmitting.value = true;
    const body = {
      first_name: firstName.value,
      surname: surname.value,
      telephone: telephone.value,
      email: email.value,
      reservation_date: reservationDate.value,
      reservation_time: reservationTime.value,
      guests: clampGuests(guests.value),
      dietary_requirements: dietary.value,
    };
    try {
      let r: Response;
      if (mode === 'edit' && reservation) {
        r = await adminFetch(`/api/admin/reservations/${reservation.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        r = await adminFetch('/api/admin/reservations', token, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      if (r.ok) {
        onSuccess();
        onClose();
        return;
      }
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      errorMessage.value = data.error ?? `Request failed (${r.status})`;
    } catch {
      errorMessage.value = 'Unable to connect. Please try again.';
    } finally {
      isSubmitting.value = false;
    }
  }

  const footer = (
    <Button variant="primary" type="submit" form="booking-modal-form" isLoading={isSubmitting.value}>
      {mode === 'edit' ? 'Save changes' : 'Create booking'}
    </Button>
  );

  return (
    <Modal open onClose={onClose} title={title} footer={footer}>
      {errorMessage.value && (
        <Alert variant="error" live="assertive" class="mb-4">
          {errorMessage.value}
        </Alert>
      )}
      <form id="booking-modal-form" class="grid gap-x-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit}>
        <Fieldset label="First name" required>
          <Input
            id="bm-first-name"
            name="first_name"
            value={firstName.value}
            required
            autocomplete="off"
            onInput={(e) => {
              firstName.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Surname" required>
          <Input
            id="bm-surname"
            name="surname"
            value={surname.value}
            required
            autocomplete="off"
            onInput={(e) => {
              surname.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Telephone">
          <Input
            id="bm-telephone"
            type="tel"
            name="telephone"
            value={telephone.value}
            autocomplete="off"
            onInput={(e) => {
              telephone.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Email">
          <Input
            id="bm-email"
            type="email"
            name="email"
            value={email.value}
            autocomplete="off"
            onInput={(e) => {
              email.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Date" required>
          <Input
            id="bm-date"
            type="date"
            name="reservation_date"
            value={reservationDate.value}
            required
            onInput={(e) => {
              reservationDate.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Time" required>
          <Input
            id="bm-time"
            type="time"
            name="reservation_time"
            value={reservationTime.value}
            required
            onInput={(e) => {
              reservationTime.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Guests" required class="sm:col-span-2">
          <Input
            id="bm-guests"
            type="number"
            name="guests"
            min={1}
            value={guests.value}
            required
            onInput={(e) => {
              guests.value = (e.target as HTMLInputElement).value;
            }}
            onBlur={() => {
              guests.value = String(clampGuests(guests.value));
            }}
          />
        </Fieldset>
        <Fieldset label="Dietary requirements" class="sm:col-span-2">
          <Textarea
            id="bm-dietary"
            name="dietary_requirements"
            value={dietary.value}
            rows={2}
            onInput={(e) => {
              dietary.value = (e.target as HTMLTextAreaElement).value;
            }}
          />
        </Fieldset>
      </form>
    </Modal>
  );
};

export default BookingModal;
